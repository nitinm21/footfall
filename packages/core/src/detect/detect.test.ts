import { describe, expect, it } from "vitest";
import { classifyAll } from "../classify";
import type { Event } from "../schema";
import { sessionize } from "../sessionize";
import { BASE_TS, makeEvent } from "../testkit";
import { detect, detectEmptyShells, EMPTY_SHELL_MAX_BYTES } from "./index";

const UA = "curl/8.1.1"; // classifies as a Tier-3 agent

function agentSessions(events: Event[]) {
  return classifyAll(sessionize(events));
}

describe("detectors", () => {
  const events = [
    makeEvent({ ua: UA, path: "/", ts: BASE_TS }),
    makeEvent({ ua: UA, path: "/llms.txt", status: 404, ts: BASE_TS + 1000 }),
    makeEvent({ ua: UA, path: "/openapi.json", status: 404, ts: BASE_TS + 2000 }),
    makeEvent({ ua: UA, path: "/docs/old-intro", status: 404, ts: BASE_TS + 3000 }),
    makeEvent({ ua: UA, path: "/docs/guide.md", status: 404, ts: BASE_TS + 4000 }),
    makeEvent({ ua: UA, path: "/docs/private", status: 403, ts: BASE_TS + 5000 }),
    makeEvent({
      ua: UA,
      path: "/docs/interactive",
      status: 200,
      resp_bytes: 900,
      ts: BASE_TS + 6000,
    }),
    makeEvent({ ua: UA, path: "/docs/guide", ts: BASE_TS + 7000 }),
    makeEvent({ ua: UA, path: "/docs/guide", ts: BASE_TS + 8000 }),
    makeEvent({ ua: UA, path: "/docs/guide", ts: BASE_TS + 9000 }),
  ];
  const sessions = agentSessions(events);
  const d = detect(sessions);

  it("finds dead ends (404/410) by path", () => {
    const paths = d.deadEnds.map((f) => f.path);
    expect(paths).toContain("/llms.txt");
    expect(paths).toContain("/docs/guide.md");
    expect(d.deadEnds.every((f) => f.agentHits === 1)).toBe(true);
  });

  it("finds auth walls (401/403)", () => {
    expect(d.authWalls.map((f) => f.path)).toEqual(["/docs/private"]);
  });

  it("finds retry loops (>=3 identical fetches within 60s)", () => {
    const loop = d.retryLoops.find((f) => f.path === "/docs/guide");
    expect(loop?.totalHits).toBe(3);
  });

  it("finds empty shells (200 html under byte threshold, agent session)", () => {
    expect(d.emptyShells.map((f) => f.path)).toContain("/docs/interactive");
  });

  it("categorises demand signals", () => {
    const byKind = Object.fromEntries(d.demand.map((s) => [s.path, s.kind]));
    expect(byKind["/llms.txt"]).toBe("llms_txt");
    expect(byKind["/openapi.json"]).toBe("openapi");
    expect(byKind["/docs/guide.md"]).toBe("markdown_mirror");
    expect(byKind["/docs/old-intro"]).toBe("moved_path");
  });
});

describe("empty_shell coverage", () => {
  it("is disabled when resp_bytes is null (source can't provide it)", () => {
    const sessions = agentSessions([
      makeEvent({ ua: UA, path: "/", ts: BASE_TS }),
      makeEvent({ ua: UA, path: "/shell", status: 200, resp_bytes: null, ts: BASE_TS + 1000 }),
    ]);
    expect(detectEmptyShells(sessions)).toHaveLength(0);
  });

  it("does not flag pages at or above the byte threshold", () => {
    const sessions = agentSessions([
      makeEvent({
        ua: UA,
        path: "/big",
        status: 200,
        resp_bytes: EMPTY_SHELL_MAX_BYTES,
        ts: BASE_TS,
      }),
    ]);
    expect(detectEmptyShells(sessions)).toHaveLength(0);
  });
});
