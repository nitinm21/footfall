// classify/ — Tier 1 UA-exact → Tier 2 browser → Tier 3 behavioural → unclassified.
// Precision over coverage. Never force-assign. Every decision carries receipts.

import type { Classification, ClassifiedSession, Session, SessionFeatures } from "../types";
import { computeFeatures } from "./features";
import { buildReceipt } from "./receipts";
import { GENERIC_BOT, lookupUa } from "./ua-table";

export { computeFeatures } from "./features";
export { buildReceipt } from "./receipts";
export { GENERIC_BOT, lookupUa, UA_TABLE, type UaEntry } from "./ua-table";

const BROWSER_UA = /Mozilla\/\d/i;
const BROWSER_ENGINE = /(Chrome|CriOS|Safari|Firefox|FxiOS|Edg|EdgA|Trident|Gecko\/\d|OPR)/;
/** Self-identifying HTTP tools/libraries — non-browser clients an agent shells out to. */
const TOOL_UA =
  /(curl|wget|python-requests|python-httpx|aiohttp|node-fetch|undici|go-http-client|okhttp|java\/|libwww|axios|\bgot\b|httpie|ruby|scrapy)/i;

/** Agents fetch few assets relative to page requests; this is the key discriminator. */
const AGENT_ASSET_MAX = 0.5;

function isBrowserUa(ua: string): boolean {
  return BROWSER_UA.test(ua) && BROWSER_ENGINE.test(ua) && !GENERIC_BOT.test(ua);
}

function classify(session: Session, f: SessionFeatures): Classification {
  const ua = session.ua;
  const receipt = buildReceipt(session, f);

  // Spoof guard (Phase 4.5): a UA claiming a verifiable crawler (Googlebot, GPTBot, …)
  // from an IP outside its published ranges is an impersonator — never trust the claim.
  if (f.botVerified === "spoofed") {
    return {
      class: "agent",
      family: "spoofed-crawler",
      confidence: "high",
      tier: 1,
      heuristic: false,
      receipt,
    };
  }

  // Tier 1 — known agent/crawler declared in the UA.
  const known = lookupUa(ua);
  if (known) {
    return {
      class: known.class,
      family: known.family,
      confidence: known.confidence,
      tier: 1,
      heuristic: false,
      receipt,
    };
  }
  // Tier 1b — a self-declared but unknown bot.
  if (ua && GENERIC_BOT.test(ua)) {
    return {
      class: "crawler",
      family: "generic-bot",
      confidence: "medium",
      tier: 1,
      heuristic: false,
      receipt,
    };
  }
  // Tier 2 — browser.
  if (ua && isBrowserUa(ua)) {
    return {
      class: "human",
      family: "browser",
      confidence: "high",
      tier: 2,
      heuristic: false,
      receipt,
    };
  }
  if (f.hasSecFetch && f.assetRatio > AGENT_ASSET_MAX) {
    return {
      class: "human",
      family: "browser",
      confidence: "medium",
      tier: 2,
      heuristic: true,
      receipt,
    };
  }
  // Tier 3 — behavioural agent (no/unknown UA + agent features).
  const toolUa = ua ? TOOL_UA.test(ua) : false;
  const agentLike =
    f.assetRatio <= AGENT_ASSET_MAX &&
    (!f.hasUa || toolUa || (f.markdownAcceptRatio ?? 0) > 0 || f.conditionalRatio > 0);
  if (agentLike && f.requests >= 1) {
    return {
      class: "agent",
      // No UA at all + agent behaviour matches Codex's signature.
      family: f.hasUa ? "unidentified" : "codex-suspect",
      confidence: "medium",
      tier: 3,
      heuristic: !f.hasUa,
      receipt,
    };
  }
  // Never force-assign.
  return {
    class: "unclassified",
    family: null,
    confidence: "low",
    tier: null,
    heuristic: false,
    receipt,
  };
}

export function classifySession(session: Session): ClassifiedSession {
  const features = computeFeatures(session);
  return { ...session, features, classification: classify(session, features) };
}

export function classifyAll(sessions: Session[]): ClassifiedSession[] {
  return sessions.map(classifySession);
}
