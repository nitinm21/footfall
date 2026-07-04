import { describe, expect, it } from "vitest";
import { classifyAll } from "../classify";
import { detect } from "../detect";
import { jsonlFieldMap, vercelDrainFieldMap } from "../normalize";
import { sessionize } from "../sessionize";
import { BASE_TS, makeEvent } from "../testkit";
import {
  agentSharePct,
  coverageMatrix,
  failureTotals,
  familyBreakdown,
  topPagesByAgentDemand,
  totalRequests,
  trafficSplit,
} from "./index";

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const sessions = classifyAll(
  sessionize([
    // agent (curl) — 3 requests
    makeEvent({ ua: "curl/8", ip_hash: "ag", path: "/a", ts: BASE_TS }),
    makeEvent({ ua: "curl/8", ip_hash: "ag", path: "/b", ts: BASE_TS + 1000 }),
    makeEvent({ ua: "curl/8", ip_hash: "ag", path: "/b", ts: BASE_TS + 2000 }),
    // human (chrome) — 2 requests (one asset)
    makeEvent({ ua: CHROME, ip_hash: "hu", path: "/a", ts: BASE_TS }),
    makeEvent({ ua: CHROME, ip_hash: "hu", path: "/x.css", asset: true, ts: BASE_TS + 500 }),
    // crawler (gptbot) — 1 request
    makeEvent({ ua: "GPTBot/1.1", ip_hash: "cr", path: "/a", ts: BASE_TS }),
  ]),
);

describe("trafficSplit", () => {
  it("counts requests and sessions per class with correct percentages", () => {
    expect(totalRequests(sessions)).toBe(6);
    const split = Object.fromEntries(trafficSplit(sessions).map((r) => [r.class, r]));
    expect(split.agent?.requests).toBe(3);
    expect(split.human?.requests).toBe(2);
    expect(split.crawler?.requests).toBe(1);
    expect(split.agent?.pct).toBe(50);
    expect(agentSharePct(sessions)).toBe(50);
  });
});

describe("familyBreakdown", () => {
  it("groups agent requests by family", () => {
    const fams = familyBreakdown(sessions);
    expect(fams).toEqual([
      { family: "unidentified", class: "agent", requests: 3, sessions: 1, heuristic: false },
    ]);
  });
});

describe("topPagesByAgentDemand", () => {
  it("counts agent vs human page requests, excluding assets and crawlers", () => {
    const byPath = Object.fromEntries(topPagesByAgentDemand(sessions).map((r) => [r.path, r]));
    expect(byPath["/b"]).toMatchObject({ agentRequests: 2, humanRequests: 0, agentSharePct: 100 });
    expect(byPath["/a"]).toMatchObject({ agentRequests: 1, humanRequests: 1, agentSharePct: 50 });
    expect(byPath["/x.css"]).toBeUndefined(); // assets excluded
  });
});

describe("coverageMatrix", () => {
  it("marks all signals present for native JSONL except real-time", () => {
    const rows = Object.fromEntries(coverageMatrix(jsonlFieldMap).map((r) => [r.field, r.present]));
    expect(rows["user-agent"]).toBe(true);
    expect(rows["response bytes"]).toBe(true);
    expect(rows["real-time delivery"]).toBe(false);
  });

  it("greys out accept/conditional/timing for a Vercel drain", () => {
    const rows = Object.fromEntries(
      coverageMatrix(vercelDrainFieldMap).map((r) => [r.field, r.present]),
    );
    expect(rows["response bytes"]).toBe(true);
    expect(rows["accept header"]).toBe(false);
    expect(rows["conditional headers"]).toBe(false);
    expect(rows["response timing"]).toBe(false);
  });
});

describe("failureTotals", () => {
  it("reports agent-focused counts and empty_shell availability from the field map", () => {
    const withFail = classifyAll(
      sessionize([
        makeEvent({ ua: "curl/8", ip_hash: "z", path: "/", ts: BASE_TS }),
        makeEvent({
          ua: "curl/8",
          ip_hash: "z",
          path: "/llms.txt",
          status: 404,
          ts: BASE_TS + 1000,
        }),
      ]),
    );
    const totals = failureTotals(detect(withFail), jsonlFieldMap);
    expect(totals.dead_end).toBe(1);
    expect(totals.empty_shell_available).toBe(true);
    expect(failureTotals(detect(withFail), vercelDrainFieldMap).empty_shell_available).toBe(true);
  });
});
