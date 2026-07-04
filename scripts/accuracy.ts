/**
 * accuracy.ts — the classifier's honesty gate (Phase 2).
 *
 * Runs the classifier over the labelled corpus (each fixtures/traces/<label>/ is
 * ground truth), prints per-class precision/recall + the unclassified rate, and
 * validates a separate canonical UA set for Tier-1 precision. Writes/updates
 * fixtures/golden/accuracy-baseline.json and fails on regression.
 *
 *   pnpm accuracy            # compute, print, and gate against the baseline
 *   pnpm accuracy --update   # rewrite the baseline (a fact, not a target)
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  classifySession,
  lookupUa,
  normalizeJsonl,
  sessionize,
  type VisitorClass,
} from "@footfall/core";

const TRACES_DIR = "fixtures/traces";
const BASELINE = "fixtures/golden/accuracy-baseline.json";
const TIER1_MIN = 0.99;
const REGRESSION = 0.02;

/** Ground-truth class per fixture label. */
const EXPECTED: Record<string, VisitorClass> = {
  "claude-code": "agent",
  cursor: "agent",
  crawler: "crawler",
  "human-browser": "human",
};

const CLASSES: VisitorClass[] = ["agent", "human", "crawler", "unclassified"];

/** Canonical UAs that exercise the Tier-1 table (real strings, not from the corpus). */
const TIER1_CASES: { ua: string; class: VisitorClass; family: string }[] = [
  { ua: "claude-code/2.1.201", class: "agent", family: "claude-code" },
  { ua: "Cursor/1.2 (Macintosh; arm64)", class: "agent", family: "cursor" },
  {
    ua: "Mozilla/5.0 (compatible; GPTBot/1.1; +https://openai.com/gptbot)",
    class: "crawler",
    family: "gptbot",
  },
  {
    ua: "Mozilla/5.0 (compatible; ClaudeBot/1.0; +https://anthropic.com/claudebot)",
    class: "crawler",
    family: "claudebot",
  },
  {
    ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    class: "crawler",
    family: "googlebot",
  },
  {
    ua: "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/bot)",
    class: "agent",
    family: "perplexitybot",
  },
  { ua: "Mozilla/5.0 ... ChatGPT-User/1.0", class: "agent", family: "chatgpt-user" },
  { ua: "CCBot/2.0 (https://commoncrawl.org/faq/)", class: "crawler", family: "ccbot" },
  {
    ua: "Mozilla/5.0 (compatible; Bytespider; https://bytedance.com)",
    class: "crawler",
    family: "bytespider",
  },
];

interface Metrics {
  sessions: number;
  overallAccuracy: number;
  unclassifiedRate: number;
  perClass: Record<string, { precision: number; recall: number; support: number }>;
  tier1: { precision: number; cases: number };
  confusion: Record<string, Record<string, number>>;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function listLabels(): string[] {
  return readdirSync(TRACES_DIR)
    .filter((d) => existsSync(join(TRACES_DIR, d, "meta.json")))
    .sort();
}

/** One classified unit per run file (each file is one labelled capture session). */
function loadClassified(): { label: string; expected: VisitorClass; predicted: VisitorClass }[] {
  const out: { label: string; expected: VisitorClass; predicted: VisitorClass }[] = [];
  for (const label of listLabels()) {
    const expected = EXPECTED[label];
    if (!expected) continue;
    const dir = join(TRACES_DIR, label);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".jsonl"))) {
      const { events } = normalizeJsonl(readFileSync(join(dir, file), "utf8"));
      for (const session of sessionize(events)) {
        out.push({ label, expected, predicted: classifySession(session).classification.class });
      }
    }
  }
  return out;
}

function computeMetrics(): Metrics {
  const rows = loadClassified();
  const confusion: Record<string, Record<string, number>> = {};
  for (const e of CLASSES) confusion[e] = Object.fromEntries(CLASSES.map((p) => [p, 0]));
  let correct = 0;
  let unclassified = 0;
  for (const r of rows) {
    (confusion[r.expected] as Record<string, number>)[r.predicted] += 1;
    if (r.predicted === r.expected) correct += 1;
    if (r.predicted === "unclassified") unclassified += 1;
  }

  const perClass: Metrics["perClass"] = {};
  for (const c of CLASSES) {
    const tp = confusion[c]?.[c] ?? 0;
    const predicted = rows.filter((r) => r.predicted === c).length;
    const support = rows.filter((r) => r.expected === c).length;
    perClass[c] = {
      precision: predicted ? round(tp / predicted) : support === 0 ? 1 : 0,
      recall: support ? round(tp / support) : 1,
      support,
    };
  }

  let tier1Correct = 0;
  for (const t of TIER1_CASES) {
    const hit = lookupUa(t.ua);
    if (hit && hit.class === t.class && hit.family === t.family) tier1Correct += 1;
  }

  return {
    sessions: rows.length,
    overallAccuracy: rows.length ? round(correct / rows.length) : 0,
    unclassifiedRate: rows.length ? round(unclassified / rows.length) : 0,
    perClass,
    tier1: { precision: round(tier1Correct / TIER1_CASES.length), cases: TIER1_CASES.length },
    confusion,
  };
}

function printTable(m: Metrics): void {
  console.log("\nPer-class (from labelled corpus):");
  console.log("class          precision  recall  support");
  console.log("-------------  ---------  ------  -------");
  for (const c of CLASSES) {
    const p = m.perClass[c];
    if (!p) continue;
    console.log(
      `${c.padEnd(13)}  ${p.precision.toFixed(3).padStart(9)}  ${p.recall.toFixed(3).padStart(6)}  ${String(p.support).padStart(7)}`,
    );
  }
  console.log(
    `\noverall accuracy: ${m.overallAccuracy.toFixed(3)}   unclassified rate: ${m.unclassifiedRate.toFixed(3)}`,
  );
  console.log(
    `Tier-1 UA precision: ${m.tier1.precision.toFixed(3)} over ${m.tier1.cases} canonical UAs`,
  );
  console.log(`sessions evaluated: ${m.sessions}\n`);
}

function gate(current: Metrics, baseline: Metrics): string[] {
  const problems: string[] = [];
  if (current.tier1.precision < TIER1_MIN) {
    problems.push(`Tier-1 precision ${current.tier1.precision} < ${TIER1_MIN}`);
  }
  for (const c of CLASSES) {
    const cur = current.perClass[c];
    const base = baseline.perClass[c];
    if (!cur || !base) continue;
    if (cur.precision < base.precision - REGRESSION) {
      problems.push(`${c} precision regressed ${base.precision} → ${cur.precision}`);
    }
    if (cur.recall < base.recall - REGRESSION) {
      problems.push(`${c} recall regressed ${base.recall} → ${cur.recall}`);
    }
  }
  return problems;
}

const metrics = computeMetrics();
printTable(metrics);

const update = process.argv.includes("--update");
if (update || !existsSync(BASELINE)) {
  writeFileSync(BASELINE, `${JSON.stringify(metrics, null, 2)}\n`);
  console.log(`baseline ${update ? "updated" : "created"} → ${BASELINE}`);
} else {
  const baseline: Metrics = JSON.parse(readFileSync(BASELINE, "utf8"));
  if (metrics.tier1.precision < TIER1_MIN) {
    console.error(`FAIL — Tier-1 precision ${metrics.tier1.precision} < ${TIER1_MIN}`);
    process.exit(1);
  }
  const problems = gate(metrics, baseline);
  if (problems.length) {
    console.error("FAIL — accuracy regression vs baseline:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log("OK — Tier-1 precision met; no regression vs baseline.");
}
