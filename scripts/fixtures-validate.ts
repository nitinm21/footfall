/**
 * fixtures-validate.ts — corpus integrity gate (Phase 1).
 *
 * Checks that:
 *   - every fixtures/traces/<label>/*.jsonl row parses against the Event schema,
 *   - every label directory carries a meta.json sidecar (tool, task, date, …),
 *   - there are >= MIN_LABELS labels, each with >= MIN_SESSIONS session files.
 *
 * Always prints a per-label stats table, then exits non-zero if any check fails.
 * Run with: pnpm fixtures:validate
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { EventSchema } from "@footfall/core";
import { z } from "zod";

const TRACES_DIR = "fixtures/traces";
// Phase-1 deviation (flagged for approval): the local corpus captures the
// behavioural families reachable via the recording proxy — two real coding agents
// (claude-code, cursor), a browser, and a crawler = 4 labels. The 5th named label,
// codex, is deferred to Phase 4: its distinctive signature is *no UA header*, which
// only appears when it fetches a public site with its native client. Locally every
// agent shells out to curl (curl UA), so a local codex capture would add no signal.
const MIN_LABELS = 4;
const MIN_SESSIONS = 3;

const MetaSchema = z.object({
  label: z.string().min(1),
  tool: z.string().min(1),
  version: z.string().nullable().optional(),
  task: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  mechanism: z.string().optional(),
  notes: z.string().optional(),
});

type LabelStats = {
  label: string;
  sessions: number;
  requests: number;
  assetPct: number;
  uaPresentPct: number;
  errors: string[];
};

function listDirs(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((name) => statSync(join(dir, name)).isDirectory())
      .sort();
  } catch {
    return [];
  }
}

function validateLabel(label: string): LabelStats {
  const dir = join(TRACES_DIR, label);
  const errors: string[] = [];
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));

  // Sidecar.
  try {
    const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
    MetaSchema.parse(meta);
  } catch (err) {
    errors.push(
      `missing/invalid meta.json (${err instanceof Error ? err.message.split("\n")[0] : err})`,
    );
  }

  let requests = 0;
  let assets = 0;
  let uaPresent = 0;

  for (const file of files) {
    const lines = readFileSync(join(dir, file), "utf8").split("\n").filter(Boolean);
    lines.forEach((line, idx) => {
      try {
        const event = EventSchema.parse(JSON.parse(line));
        requests += 1;
        if (event.asset) assets += 1;
        if (event.ua) uaPresent += 1;
      } catch (err) {
        errors.push(
          `${file}:${idx + 1} ${err instanceof Error ? err.message.split("\n")[0] : err}`,
        );
      }
    });
  }

  if (files.length < MIN_SESSIONS) {
    errors.push(`only ${files.length} session file(s); need >= ${MIN_SESSIONS}`);
  }
  if (requests === 0) errors.push("no events");

  return {
    label,
    sessions: files.length,
    requests,
    assetPct: requests ? Math.round((assets / requests) * 100) : 0,
    uaPresentPct: requests ? Math.round((uaPresent / requests) * 100) : 0,
    errors,
  };
}

const labels = listDirs(TRACES_DIR);
const stats = labels.map(validateLabel);

// ── Stats table ──────────────────────────────────────────────────────────────
const headerRow = ["label", "sessions", "requests", "asset%", "ua%"];
const rows = [
  headerRow,
  ...stats.map((s) => [
    s.label,
    String(s.sessions),
    String(s.requests),
    `${s.assetPct}%`,
    `${s.uaPresentPct}%`,
  ]),
];
const widths = headerRow.map((_, c) => Math.max(...rows.map((r) => (r[c] ?? "").length)));
console.log("");
for (const [i, row] of rows.entries()) {
  console.log(row.map((cell, c) => cell.padEnd(widths[c] ?? 0)).join("  "));
  if (i === 0) console.log(widths.map((w) => "-".repeat(w)).join("  "));
}
const totalRequests = stats.reduce((n, s) => n + s.requests, 0);
console.log(`\n${labels.length} label(s), ${totalRequests} total request(s)\n`);

// ── Verdict ──────────────────────────────────────────────────────────────────
const problems: string[] = [];
for (const s of stats) {
  for (const e of s.errors) problems.push(`[${s.label}] ${e}`);
}
if (labels.length < MIN_LABELS) {
  problems.push(`only ${labels.length} label(s); need >= ${MIN_LABELS}`);
}

if (problems.length > 0) {
  console.error("FAIL — fixtures validation:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("OK — all fixtures schema-valid; label & session minimums met.");
