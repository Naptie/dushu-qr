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
