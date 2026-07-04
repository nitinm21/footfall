import type { Session, SessionFeatures } from "../types";

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[mid] ?? null;
  return ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
}

const MARKDOWN_ACCEPT = /(text\/markdown|text\/x-markdown|application\/markdown|\bmarkdown\b)/i;

/** Compute the behavioural feature vector for a session (events are pre-sorted by ts). */
export function computeFeatures(session: Session): SessionFeatures {
  const ev = session.events;
  const requests = ev.length;
  const assetRequests = ev.filter((e) => e.asset).length;
  const pageRequests = requests - assetRequests;

  const accepts = ev.map((e) => e.accept).filter((a): a is string => a !== null);
  const markdownAcceptRatio = accepts.length
    ? accepts.filter((a) => MARKDOWN_ACCEPT.test(a)).length / accepts.length
    : null;

  const gaps: number[] = [];
  for (let i = 1; i < ev.length; i++) {
    const prev = ev[i - 1];
    const cur = ev[i];
    if (prev && cur) gaps.push(cur.ts - prev.ts);
  }

  const statusOf = (min: number, max: number) =>
    ev.filter((e) => e.status !== null && e.status >= min && e.status <= max).length;

  return {
    requests,
    assetRequests,
    pageRequests,
    assetRatio: requests ? assetRequests / requests : 0,
    uniquePaths: new Set(ev.map((e) => e.path)).size,
    markdownAcceptRatio,
    conditionalRatio: requests ? ev.filter((e) => e.conditional).length / requests : 0,
    hasUa: session.ua !== null && session.ua.trim() !== "",
    hasSecFetch: ev.some((e) => e.sec_fetch_mode !== null),
    medianGapMs: median(gaps),
    notFound: ev.filter((e) => e.status === 404 || e.status === 410).length,
    authBlocked: ev.filter((e) => e.status === 401 || e.status === 403).length,
    serverErrors: statusOf(500, 599),
    botVerified: ev.some((e) => e.bot_verified === "spoofed")
      ? "spoofed"
      : ev.some((e) => e.bot_verified === "verified")
        ? "verified"
        : null,
  };
}
