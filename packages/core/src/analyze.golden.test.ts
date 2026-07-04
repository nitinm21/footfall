import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyze } from "./analyze";
import { jsonlFieldMap, normalizeJsonl } from "./normalize";
import type { Event } from "./schema";
import type { AnalysisResult, VisitorClass } from "./types";

const TRACES = fileURLToPath(new URL("../../../fixtures/traces/", import.meta.url));

/** Load every committed corpus trace as one Event stream. */
function loadCorpus(): Event[] {
  const events: Event[] = [];
  for (const label of readdirSync(TRACES).sort()) {
    const dir = `${TRACES}${label}`;
    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue; // not a directory
    }
    for (const file of files.sort()) {
      events.push(...normalizeJsonl(readFileSync(`${dir}/${file}`, "utf8")).events);
    }
  }
  return events;
}

/** A deterministic, human-readable subset of the analysis for golden comparison. */
function summarize(r: AnalysisResult) {
  const classCounts: Record<VisitorClass, number> = {
    agent: 0,
    human: 0,
    crawler: 0,
    unclassified: 0,
  };
  for (const s of r.sessions) classCounts[s.classification.class] += 1;
  return {
    source: r.meta.source,
    totalRequests: r.meta.totalRequests,
    classifiedPct: r.meta.classifiedPct,
    agentSharePct: r.agentSharePct,
    trafficSplit: r.trafficSplit,
    families: r.families,
    topPages: r.topPages.slice(0, 8),
    failureTotals: r.failureTotals,
    demand: r.demand,
    recommendations: r.recommendations.map((x) => ({
      title: x.title,
      metric: x.metric,
      heuristic: x.heuristic,
    })),
    coverage: r.coverage,
    sessionClassCounts: classCounts,
  };
}

describe("analyze() golden over the committed corpus", () => {
  it("produces a stable analysis result", () => {
    const events = loadCorpus();
    expect(events.length).toBeGreaterThan(100);
    const result = analyze(events, jsonlFieldMap, {
      siteName: "target-local",
      baseUrl: "https://target-local",
    });
    expect(summarize(result)).toMatchSnapshot();
  });
});
