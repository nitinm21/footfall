import { createHash } from "node:crypto";

/**
 * Salted IP hash used when normalizing log sources that carry a raw IP.
 * Deterministic given (salt, ip) — the raw IP is never retained. The live
 * middleware hashes at the edge instead; this is only for batch log ingest.
 */
export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}
