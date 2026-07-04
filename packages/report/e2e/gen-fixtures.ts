// Pre-generate report HTML for the Playwright e2e (run via tsx, which handles the
// workspace TS that Playwright's own loader would not transform in node_modules).

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_FIELDS, analyze, type Event, jsonlFieldMap, normalizeJsonl } from "@footfall/core";
import { renderReport } from "@footfall/report";

const here = dirname(fileURLToPath(import.meta.url));
const tracesDir = join(here, "..", "..", "..", "fixtures", "traces");
const outDir = join(here, ".generated");
mkdirSync(outDir, { recursive: true });

const events: Event[] = [];
for (const label of readdirSync(tracesDir).sort()) {
  const dir = join(tracesDir, label);
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  } catch {
    continue;
  }
  for (const f of files.sort())
    events.push(...normalizeJsonl(readFileSync(join(dir, f), "utf8")).events);
}

const accuracy = { overallAccuracy: 0.923, tier1Precision: 1, unclassifiedRate: 0 };
const opts = { siteName: "target-local (Acme SDK)", accuracy };

// Full-fidelity report.
writeFileSync(join(outDir, "report.html"), renderReport(analyze(events, jsonlFieldMap), opts));

// Low-fidelity source (no response bytes) → empty-shell module must grey out.
const lowFi = {
  source: "drain-lite",
  realtime: false,
  fields: ALL_FIELDS.filter((f) => f !== "resp_bytes"),
};
writeFileSync(join(outDir, "report-lowfi.html"), renderReport(analyze(events, lowFi), opts));

console.log(`gen-fixtures: wrote report.html + report-lowfi.html to ${outDir}`);
