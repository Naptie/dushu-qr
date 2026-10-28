const API_BASE = 'https://api.215123.cn';

export interface LoginResult {
  token: string;
  userId: string;
  name: string | null;
}

export interface CodeInfo {
  status: number;
  locked: number;
  lockedName: string | null;
  text: string;
  name: string;
  qrCode: string;
  qrCodeStatus: number;
  /** 1 = QR display is active; 0 + non-null passTime = no permission view */
  mackCode: number;
  phone: string;
  apartment: string;
  companyName: string;
  passTime: string;
}

export interface QrPayload {
  qr: string;
  /** Epoch ms embedded in the QR string (when the server signed it). */
  issuedAt: number;
  info: CodeInfo | null;
}

const OPENID_PATTERN = /^o[a-zA-Z0-9_-]{27}$/;

export function isValidOpenId(value: string): boolean {
  return OPENID_PATTERN.test(value.trim());
}

/** 网络层/服务器故障，重试可能成功；与「凭证无效」相区分。 */
export class ApiNetworkError extends Error {}

let token: string | null = null;

async function mint(openId: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(
      `${API_BASE}/web-app/auth/certificateLogin?openId=${encodeURIComponent(openId)}`
    );
  } catch {
    throw new ApiNetworkError('无法连接服务器，请检查网络');
  }
  let body: {
    success: boolean;
    code: number;
    message: string;
    data?: { token?: string };
  };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    throw new ApiNetworkError(`服务器响应异常（HTTP ${res.status}）`);
  }
  if (!body.success || body.code !== 200 || !body.data?.token) {
    throw new Error(`Open ID 无效或登录失败：${body.message ?? `HTTP ${res.status}`}`);
  }
  token = body.data.token;
}

export type VerifyResult =
  | { ok: true; info: CodeInfo | null }
  | { ok: false; reason: 'invalid' | 'network'; message: string };

/**
 * 校验 openId：certificateLogin 成功即证明凭证有效，并尽量取回通行
 * 信息用于展示。调用方只应在 `ok` 为真时保存该 openId。
 */
export async function verifyOpenId(openId: string): Promise<VerifyResult> {
  token = null;
  try {
    await mint(openId);
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof ApiNetworkError ? 'network' : 'invalid',
      message: e instanceof Error ? e.message : String(e)
    };
  }
  try {
    return { ok: true, info: await fetchCodeInfo(openId) };
  } catch {
    // 登录已成功，凭证有效；信息获取失败多为瞬时问题，不阻断流程。
    return { ok: true, info: null };
  }
}

async function apiGet<T>(path: string, openId: string, retry = true): Promise<T> {
  if (!token) await mint(openId);
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { satoken: token! }
  });
  const body = (await res.json()) as {
    success: boolean;
    code: number;
    message: string;
    data: T;
  };
  const authFailed =
    body.code === 401 ||
    body.message?.includes('认证失败') ||
    (typeof body.data === 'string' && body.data.trim() === '--');
  if (authFailed && retry) {
    // The satoken was kicked (e.g. by the mini program re-logging in);
    // mint a fresh one and retry exactly once.
    token = null;
    return apiGet(path, openId, false);
  }
  if (!body.success || body.code !== 200) {
    throw new Error(`${body.message ?? `HTTP ${res.status}`}（code ${body.code}）`);
  }
  return body.data;
}

export function parseQrTimestamp(qr: string): number {
  const parts = qr.split('|-|');
  const ts = Number(parts[2]);
  return Number.isFinite(ts) ? ts : 0;
}

export async function fetchQr(openId: string): Promise<QrPayload> {
  const qr = await apiGet<string>('/pms/welcome/make-qrcode', openId);
  if (typeof qr !== 'string' || !qr.startsWith('kjxt|-|')) {
    throw new Error(`make-qrcode 返回异常：${JSON.stringify(qr).slice(0, 100)}`);
  }
  return { qr, issuedAt: parseQrTimestamp(qr), info: null };
}

export async function fetchCodeInfo(openId: string): Promise<CodeInfo> {
  return apiGet<CodeInfo>('/pms/welcome/make-code-info', openId);
}
