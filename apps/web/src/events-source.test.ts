import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { analyze } from "@footfall/core";
import { describe, expect, it } from "vitest";
import { getSiteEvents } from "./events-source";

// Resolve fixtures from the repo root regardless of vitest's cwd.
process.env.FOOTFALL_FIXTURE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const DEMO = {
  token: "demo",
  source: "fixture" as const,
  fixture: "fixtures/demo/dashboard-demo.jsonl",
};
const DAY = 86_400_000;

describe("fixture event source", () => {
  it("loads the demo dataset and classifies an honest agent mix", async () => {
    const { events, fieldMap } = await getSiteEvents(DEMO, 0, Number.MAX_SAFE_INTEGER);
    expect(events.length).toBeGreaterThan(1000);

    const r = analyze(events, fieldMap, { site: "demo" });
    // agents are a large share, and unclassified is never force-assigned to 0-inflate coverage
    expect(r.agentSharePct).toBeGreaterThan(30);
    expect(r.trafficSplit.find((t) => t.class === "unclassified")?.requests).toBe(0);
    // the Phase 4.5 spoof story and known families surface
    expect(r.spoofedRequests).toBeGreaterThan(0);
    expect(r.families.map((f) => f.family)).toContain("claude-code");
  });

  it("windows events by [since, until)", async () => {
    const all = await getSiteEvents(DEMO, 0, Number.MAX_SAFE_INTEGER);
    const to = Math.max(...all.events.map((e) => e.ts));
    const since = to - 7 * DAY;
    const win = await getSiteEvents(DEMO, since, to + 1);
    expect(win.events.length).toBeLessThan(all.events.length);
    expect(win.events.every((e) => e.ts >= since && e.ts < to + 1)).toBe(true);
  });
});
