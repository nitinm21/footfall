// verify/ — pure IP-CIDR bot verification. Catches UA spoofing (e.g. Cursor claiming
// Googlebot) by checking the claim against the operator's published IP ranges. Pure and
// synchronous (no DNS/I/O) so the edge middleware can call it and stay fail-open.

import { ipInCidr } from "./cidr";
import { matchOperator } from "./operators";
import { OPERATOR_RANGES } from "./ranges";

export { ipInCidr } from "./cidr";
export { matchOperator, OPERATORS, type VerifiableOperator } from "./operators";
export { OPERATOR_RANGES } from "./ranges";

export type VerifyResult = "verified" | "spoofed" | "unverifiable";

/**
 * Verify a self-declared operator UA against its published IP ranges.
 * - not a verifiable-operator UA, or IP/ranges unavailable → "unverifiable"
 * - claimed operator + IP in its ranges → "verified"
 * - claimed operator + IP NOT in its ranges → "spoofed" (impersonation)
 */
export function verifyBot(
  ua: string | null,
  ip: string | null,
): { operator: string | null; result: VerifyResult } {
  const op = matchOperator(ua);
  if (!op) return { operator: null, result: "unverifiable" };
  const ranges = OPERATOR_RANGES[op.operator];
  if (!ranges || !ip || ip === "unknown") return { operator: op.operator, result: "unverifiable" };
  const inRange = ranges.some((cidr) => ipInCidr(ip, cidr));
  return { operator: op.operator, result: inRange ? "verified" : "spoofed" };
}

/** The value stamped on the Event: "verified" | "spoofed" | null (unverifiable → null). */
export function botVerified(ua: string | null, ip: string | null): "verified" | "spoofed" | null {
  const { result } = verifyBot(ua, ip);
  return result === "unverifiable" ? null : result;
}
