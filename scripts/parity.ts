/**
 * parity.ts — report ⇄ dashboard parity (Phase 4).
 *
 * The Locked Decision: aggregations are defined once in `core` and the Tinybird pipes
 * must mirror them. This checks the classification-free metrics (daily requests, top
 * paths) — which establishes the parity harness end-to-end — against the deployed pipes.
 *
 *   pnpm parity            # prints the TS reference; runs live compare if TINYBIRD_TOKEN set
 *
 * The class-based pipes (traffic split, families, top-pages-by-agent) require
 * sessionization + classification in SQL and are the flagged follow-on (see tinybird/README.md).
 */

import { readFileSync } from "node:fs";
import { normalizeJsonl } from "@footfall/core";

const FIXTURE = "fixtures/logs/corpus-sample.jsonl";

function tsReference() {
  const { events } = normalizeJsonl(readFileSync(FIXTURE, "utf8"));
  const byDay = new Map<string, number>();
  const byPath = new Map<string, number>();
  for (const e of events) {
    const day = new Date(e.ts).toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
    if (!e.asset) byPath.set(e.path, (byPath.get(e.path) ?? 0) + 1);
  }
  const requestsByDay = [...byDay.entries()].sort().map(([day, requests]) => ({ day, requests }));
  const topPaths = [...byPath.entries()]
    .map(([path, requests]) => ({ path, requests }))
    .sort((a, b) => b.requests - a.requests || a.path.localeCompare(b.path))
    .slice(0, 20);
  return { requestsByDay, topPaths, total: events.length };
}

async function queryPipe(name: string, token: string, host: string): Promise<unknown[]> {
  const res = await fetch(`${host}/v0/pipes/${name}.json`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`pipe ${name}: ${res.status}`);
  const json = (await res.json()) as { data: unknown[] };
  return json.data;
}

async function main(): Promise<void> {
  const ref = tsReference();
  console.log(`TS reference over ${FIXTURE} (${ref.total} events):`);
  console.log(`  requests_by_day: ${JSON.stringify(ref.requestsByDay)}`);
  console.log(`  top_paths (first 3): ${JSON.stringify(ref.topPaths.slice(0, 3))}`);

  const token = process.env.TINYBIRD_TOKEN;
  const host = process.env.TINYBIRD_HOST ?? "https://api.tinybird.co";
  if (!token) {
    console.log(
      "\nSKIP live parity — set TINYBIRD_TOKEN (and push tinybird/) to compare against pipes.",
    );
    return;
  }

  const problems: string[] = [];
  const day = (await queryPipe("requests_by_day", token, host)) as {
    day: string;
    requests: number;
  }[];
  if (JSON.stringify(day) !== JSON.stringify(ref.requestsByDay)) {
    problems.push("requests_by_day differs between core (TS) and Tinybird pipe");
  }
  const paths = (await queryPipe("top_paths", token, host)) as { path: string; requests: number }[];
  if (JSON.stringify(paths) !== JSON.stringify(ref.topPaths)) {
    problems.push("top_paths differs between core (TS) and Tinybird pipe");
  }

  if (problems.length) {
    console.error("\nFAIL — parity:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log("\nOK — core aggregations ≡ Tinybird pipes on the fixture window.");
}

await main();
