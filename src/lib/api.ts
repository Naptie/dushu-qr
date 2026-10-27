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

let token: string | null = null;

async function mint(openId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/web-app/auth/certificateLogin?openId=${encodeURIComponent(openId)}`
  );
  const body = (await res.json()) as {
    success: boolean;
    code: number;
    message: string;
    data?: { token?: string };
  };
  if (!body.success || body.code !== 200 || !body.data?.token) {
    throw new Error(`Open ID 无效或登录失败：${body.message ?? `HTTP ${res.status}`}`);
  }
  token = body.data.token;
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
