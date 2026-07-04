import type { Receipt, ReceiptSignal, Session, SessionFeatures } from "../types";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * Build the human-readable evidence list shown in the dashboard's receipts panel.
 * `present: true` renders a ✓ (an observed signal); `false` renders a — (a notable
 * absence, e.g. "no user-agent header"). This is the trust feature: if we can't show
 * the signals, we don't show a family.
 */
export function buildReceipt(session: Session, f: SessionFeatures): Receipt {
  const durationSec = Math.max(0, Math.round((session.end - session.start) / 1000));
  const signals: ReceiptSignal[] = [];

  if (f.hasUa && session.ua) {
    signals.push({ text: `user-agent: ${session.ua}`, present: true });
  } else {
    signals.push({ text: "no user-agent header sent", present: false });
  }

  if (f.botVerified === "verified") {
    signals.push({ text: "IP verified against the operator's published ranges", present: true });
  } else if (f.botVerified === "spoofed") {
    signals.push({
      text: "claimed a verifiable crawler UA from an unlisted IP (spoofed)",
      present: false,
    });
  }

  signals.push({
    text: `${f.assetRequests} asset fetches across ${f.requests} request${f.requests === 1 ? "" : "s"}`,
    present: true,
  });

  signals.push({
    text: `${f.uniquePaths} unique path${f.uniquePaths === 1 ? "" : "s"}`,
    present: true,
  });

  if (f.markdownAcceptRatio !== null) {
    signals.push({
      text: `accept prefers markdown on ${pct(f.markdownAcceptRatio)} of requests`,
      present: f.markdownAcceptRatio > 0,
    });
  } else {
    signals.push({ text: "no accept header in this source", present: false });
  }

  if (f.hasSecFetch) {
    signals.push({ text: "sends sec-fetch-* browser headers", present: true });
  }

  if (f.conditionalRatio > 0) {
    signals.push({ text: "sends conditional requests (if-none-match)", present: true });
  } else {
    signals.push({ text: "no conditional requests — refetches full pages", present: false });
  }

  if (f.medianGapMs !== null) {
    signals.push({ text: `median gap ${(f.medianGapMs / 1000).toFixed(1)}s`, present: true });
  }

  const summary = `${f.requests} request${f.requests === 1 ? "" : "s"} over ${durationSec}s`;
  return { summary, signals };
}
