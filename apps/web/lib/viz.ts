// Palette + labels shared with the report renderer, so the dashboard and the static report
// speak the same visual language. Kept in sync with packages/report/src/report.ts.

import type { VisitorClass } from "@footfall/core";

export const CLASS_COLOR: Record<VisitorClass, string> = {
  human: "#9aa1ab",
  agent: "#2743d6",
  crawler: "#d99a2b",
  unclassified: "#c9cdd4",
};

export const CLASS_LABEL: Record<VisitorClass, string> = {
  human: "Humans",
  agent: "AI agents",
  crawler: "Crawlers / bots",
  unclassified: "Unclassified",
};

export const FAMILY_COLOR: Record<string, string> = {
  "claude-code": "#d97757",
  "claude-user": "#d97757",
  cursor: "#16181d",
  codex: "#10a37f",
  "codex-suspect": "#10a37f",
  "chatgpt-user": "#10a37f",
  perplexitybot: "#20808d",
  "perplexity-user": "#20808d",
  googlebot: "#d99a2b",
  "spoofed-crawler": "#c73a2e",
  unidentified: "#b9bec6",
  "generic-bot": "#d99a2b",
};

const FAMILY_NAME: Record<string, string> = {
  "claude-code": "Claude Code",
  "claude-user": "Claude",
  cursor: "Cursor",
  codex: "Codex",
  "codex-suspect": "Codex-suspect",
  "chatgpt-user": "ChatGPT",
  unidentified: "Unidentified agent",
  "spoofed-crawler": "Spoofed crawler",
  "generic-bot": "Bot",
  perplexitybot: "Perplexity",
  "perplexity-user": "Perplexity",
  googlebot: "Googlebot",
};

export function familyLabel(family: string, heuristic = false): string {
  const base =
    FAMILY_NAME[family] ?? family.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return heuristic ? `${base} ⚠ behavioral` : base;
}

export function familyColor(family: string): string {
  return FAMILY_COLOR[family] ?? "#7c6fd0";
}

/** Nice round axis ceiling (matches report.ts). */
export function niceCeil(v: number): number {
  if (v <= 0) return 10;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (p * m >= v) return p * m;
  }
  return p * 10;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Jul 4" from a YYYY-MM-DD day string. */
export function shortDay(date: string): string {
  return `${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`;
}

/** "Jul 4, 2026" from epoch ms (UTC). */
export function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function dateRange(from: number, to: number): string {
  const a = fmtDate(from);
  const b = fmtDate(to);
  return a === b ? a : `${a} – ${b}`;
}

export const FAILURE_LABEL: Record<string, string> = {
  dead_end: "404 / 410",
  auth_wall: "401 auth",
  empty_shell: "empty shell",
  retry_loop: "retry loop",
};
