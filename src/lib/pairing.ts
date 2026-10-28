import qrcode from 'qrcode-generator';
import { isValidOpenId } from './api.js';

/** localStorage 中承载 openId 的键名。 */
export const OPENID_KEY = 'hh_openid';

/** fragment 中承载 openId 的键名。 */
export const PAIRING_HASH_KEY = 'openid';

/**
 * 基于当前页面地址生成配对链接。
 */
export function buildPairingLink(pageUrl: string, openId: string): string {
  const url = new URL(pageUrl);
  url.search = '';
  url.hash = '';
  url.hash = `${PAIRING_HASH_KEY}=${encodeURIComponent(openId)}`;
  return url.toString();
}

/**
 * 从 fragment 中取出 openId；没有该键时返回 `null`。
 */
export function readOpenIdFromHash(hash: string): string | null {
  if (!hash) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return params.get(PAIRING_HASH_KEY);
}

/**
 * 从任意粘贴文本中提取 openId：接受 28 位原始 ID，
 * 或任何携带 `#openid=…` fragment 的配对链接。
 * 扫码导入与手动粘贴共用这一条解析路径。
 */
export function extractOpenId(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (isValidOpenId(trimmed)) return trimmed;
  try {
    const fromHash = readOpenIdFromHash(new URL(trimmed).hash);
    if (fromHash && isValidOpenId(fromHash)) return fromHash;
  } catch {
    // 不是合法 URL，按无配对信息处理。
  }
  return null;
}

/**
 * 渲染供相机/扫码器读取的 QR SVG（纠错级 M、4 模块静区）。
 * 配对码与指南入口码共用。
 */
export function renderQrSvg(text: string, title = '扫码打开慧湖通通行码', alt = '二维码'): string {
  // Error correction 'M' instead of the mini program's 'L': this QR is read
  // by a phone camera off a screen, so it can afford the extra redundancy.
  // `margin: 24` is a 4-module quiet zone (cellSize 6) — scanners need it.
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  // `alt`/`title` are honoured by the library but missing from its bundled
  // typings, so the options object is kept out of the call expression.
  const options = {
    cellSize: 6,
    margin: 24,
    scalable: true,
    title,
    alt
  };
  return q.createSvgTag(options);
}
