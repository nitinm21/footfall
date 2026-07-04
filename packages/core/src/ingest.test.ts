import { describe, expect, it } from "vitest";
import { type Correction, resolveStatuses } from "./ingest";
import { makeEvent } from "./testkit";

describe("resolveStatuses", () => {
  it("applies a correction by request_id", () => {
    const events = [makeEvent({ request_id: "r1", status: null, path: "/gone" })];
    const corrections: Correction[] = [{ request_id: "r1", status: 404, path: "/gone", ts: 1 }];
    expect(resolveStatuses(events, corrections)[0]?.status).toBe(404);
  });

  it("assumes 200 for an uncorrected non-asset GET page", () => {
    const events = [makeEvent({ request_id: "r2", status: null, path: "/docs", asset: false })];
    expect(resolveStatuses(events, [])[0]?.status).toBe(200);
  });

  it("leaves assets and API routes null (coverage matrix handles them)", () => {
    const asset = makeEvent({ status: null, path: "/app.css", asset: true });
    const api = makeEvent({ status: null, path: "/api/x", asset: false });
    const resolved = resolveStatuses([asset, api], []);
    expect(resolved[0]?.status).toBeNull();
    expect(resolved[1]?.status).toBeNull();
  });

  it("does not overwrite an already-known status", () => {
    const events = [makeEvent({ status: 500, path: "/boom" })];
    expect(resolveStatuses(events, [])[0]?.status).toBe(500);
  });
});
