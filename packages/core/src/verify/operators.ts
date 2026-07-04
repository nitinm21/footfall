import type { VisitorClass } from "../types";

/** A crawler/agent whose identity claim can be IP-verified against published ranges. */
export interface VerifiableOperator {
  operator: string;
  family: string;
  class: VisitorClass;
  /** Matches the self-declared UA. */
  ua: RegExp;
}

/** Only operators with published IP ranges (see ranges.ts) can be verified. */
export const OPERATORS: VerifiableOperator[] = [
  { operator: "googlebot", family: "googlebot", class: "crawler", ua: /Googlebot/i },
  { operator: "bingbot", family: "bingbot", class: "crawler", ua: /bingbot/i },
  { operator: "gptbot", family: "gptbot", class: "crawler", ua: /GPTBot/i },
];

export function matchOperator(ua: string | null): VerifiableOperator | null {
  if (!ua) return null;
  return OPERATORS.find((o) => o.ua.test(ua)) ?? null;
}
