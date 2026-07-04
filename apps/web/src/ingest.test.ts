import { EVENT_VERSION, type Event } from "@footfall/core";
import { describe, expect, it } from "vitest";
import { handleIngest, memorySink } from "./ingest";

function event(overrides: Partial<Event> = {}): Event {
  return {
    v: EVENT_VERSION,
    ts: 1_751_500_000_000,
    site: "site_a",
    method: "GET",
    path: "/",
    has_query: false,
    status: null,
    resp_bytes: null,
    content_type: null,
    duration_ms: null,
    ua: "curl/8",
    accept: null,
    sec_fetch_mode: null,
    referer_host: null,
    conditional: false,
    ip_hash: "hash",
    asset: false,
    ...overrides,
  };
}

describe("handleIngest", () => {
  it("rejects a missing token with 401", async () => {
    const { sink } = memorySink();
    expect((await handleIngest({ site: "site_a" }, null, sink)).status).toBe(401);
  });

  it("rejects an invalid payload with 400", async () => {
    const { sink } = memorySink();
    expect((await handleIngest({ nope: true }, "site_a", sink)).status).toBe(400);
  });

  it("rejects a token/site mismatch with 403", async () => {
    const { sink } = memorySink();
    const res = await handleIngest({ site: "site_a", events: [event()] }, "site_b", sink);
    expect(res.status).toBe(403);
  });

  it("rejects an oversized batch with 413", async () => {
    const { sink } = memorySink();
    const events = Array.from({ length: 3 }, () => event());
    expect((await handleIngest({ site: "site_a", events }, "site_a", sink, 2)).status).toBe(413);
  });

  it("accepts a valid batch (202) and hands it to the sink", async () => {
    const { sink, received } = memorySink();
    const res = await handleIngest(
      { site: "site_a", events: [event({ path: "/docs" })], dropped: 4 },
      "site_a",
      sink,
    );
    expect(res.status).toBe(202);
    expect(received).toHaveLength(1);
    expect(received[0]?.events?.[0]?.path).toBe("/docs");
    expect(received[0]?.dropped).toBe(4);
  });

  it("accepts corrections", async () => {
    const { sink, received } = memorySink();
    const res = await handleIngest(
      { site: "site_a", corrections: [{ request_id: "r1", status: 404, path: "/x", ts: 1 }] },
      "site_a",
      sink,
    );
    expect(res.status).toBe(202);
    expect(received[0]?.corrections?.[0]?.status).toBe(404);
  });

  it("returns 502 if the sink throws", async () => {
    const sink = async () => {
      throw new Error("down");
    };
    expect((await handleIngest({ site: "site_a", events: [event()] }, "site_a", sink)).status).toBe(
      502,
    );
  });
});
