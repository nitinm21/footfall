/**
 * Edge-runtime IP hashing (Web Crypto, not node:crypto). The salt rotates daily so
 * sessions stitch within a day but the raw IP is never stored or reversible across days.
 */

/** The salt in effect for the day containing `nowMs`. */
export function dailySalt(saltBase: string, nowMs: number): string {
  const day = new Date(nowMs).toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  return `${saltBase}:${day}`;
}

/** SHA-256 of (dailySalt + ip), hex, truncated to 32 chars. Async (crypto.subtle). */
export async function hashIp(ip: string, saltBase: string, nowMs: number): Promise<string> {
  const data = new TextEncoder().encode(`${dailySalt(saltBase, nowMs)}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  let hex = "";
  for (const b of new Uint8Array(digest)) hex += b.toString(16).padStart(2, "0");
  return hex.slice(0, 32);
}
