import type { Confidence, VisitorClass } from "../types";

/** One row of the Tier-1 UA-exact table. Data, not code — trivially extendable. */
export interface UaEntry {
  /** Case-insensitive substring/regex tested against the raw User-Agent. */
  pattern: RegExp;
  family: string;
  class: VisitorClass;
  confidence: Confidence;
}

/**
 * Tier 1 — known agents and crawlers that declare themselves in the UA.
 * Order matters: first match wins, so put specific patterns before generic ones.
 * `agent` = interactive / on-behalf-of-a-user; `crawler` = background/training bots.
 */
export const UA_TABLE: UaEntry[] = [
  // ── Interactive coding agents ──
  { pattern: /claude-code/i, family: "claude-code", class: "agent", confidence: "high" },
  { pattern: /\bcursor\b/i, family: "cursor", class: "agent", confidence: "high" },
  { pattern: /\b(codex|codex-cli)\b/i, family: "codex", class: "agent", confidence: "high" },

  // ── On-behalf-of-a-user fetchers (real-time, agentic) ──
  { pattern: /ChatGPT-User/i, family: "chatgpt-user", class: "agent", confidence: "high" },
  { pattern: /Claude-User/i, family: "claude-user", class: "agent", confidence: "high" },
  { pattern: /Perplexity-User/i, family: "perplexity-user", class: "agent", confidence: "high" },
  { pattern: /PerplexityBot/i, family: "perplexitybot", class: "agent", confidence: "high" },
  { pattern: /OAI-SearchBot/i, family: "oai-searchbot", class: "agent", confidence: "high" },

  // ── Training / search crawlers ──
  { pattern: /GPTBot/i, family: "gptbot", class: "crawler", confidence: "high" },
  { pattern: /ClaudeBot/i, family: "claudebot", class: "crawler", confidence: "high" },
  { pattern: /anthropic-ai/i, family: "anthropic-ai", class: "crawler", confidence: "high" },
  { pattern: /Google-Extended/i, family: "google-extended", class: "crawler", confidence: "high" },
  { pattern: /Googlebot/i, family: "googlebot", class: "crawler", confidence: "high" },
  { pattern: /bingbot/i, family: "bingbot", class: "crawler", confidence: "high" },
  { pattern: /Applebot/i, family: "applebot", class: "crawler", confidence: "high" },
  { pattern: /Amazonbot/i, family: "amazonbot", class: "crawler", confidence: "high" },
  { pattern: /Bytespider/i, family: "bytespider", class: "crawler", confidence: "high" },
  { pattern: /CCBot/i, family: "ccbot", class: "crawler", confidence: "high" },
  { pattern: /cohere-ai/i, family: "cohere-ai", class: "crawler", confidence: "high" },
  { pattern: /Meta-ExternalAgent/i, family: "meta-external", class: "crawler", confidence: "high" },
  { pattern: /DuckDuckBot/i, family: "duckduckbot", class: "crawler", confidence: "high" },
  { pattern: /YandexBot/i, family: "yandexbot", class: "crawler", confidence: "high" },
];

/** Generic bot token — Tier 1b. Matches self-declared bots not in the exact table. */
export const GENERIC_BOT = /(bot|crawler|spider|scraper|slurp|crawl|fetcher)\b/i;

/** Look up a UA in the exact table. Returns null if no known entry matches. */
export function lookupUa(ua: string | null): UaEntry | null {
  if (!ua) return null;
  for (const entry of UA_TABLE) {
    if (entry.pattern.test(ua)) return entry;
  }
  return null;
}
