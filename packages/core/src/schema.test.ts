import { describe, expect, it } from "vitest";
import { EVENT_VERSION, type Event, EventSchema, parseEvent } from "./schema";

/** A fully-populated, valid event used as the round-trip baseline. */
const fullEvent: Event = {
  v: EVENT_VERSION,
  ts: 1_751_500_000_000,
  site: "site_abc123",
  method: "GET",
  path: "/docs/getting-started",
  has_query: false,
  status: 200,
  resp_bytes: 8421,
  content_type: "text/html; charset=utf-8",
  duration_ms: 42,
  ua: "claude-code/1.2.3",
  accept: "text/markdown, text/html;q=0.9",
  sec_fetch_mode: "navigate",
  referer_host: "docs.example.com",
  conditional: false,
  ip_hash: "9f86d081884c7d659a2feaa0c55ad015",
  asset: false,
};

/** A low-fidelity event where every source-dependent field is null (drives the coverage matrix). */
const sparseEvent: Event = {
  v: EVENT_VERSION,
  ts: 1_751_500_001_000,
  site: "site_abc123",
  method: "GET",
  path: "/api/data",
  has_query: true,
  status: null,
  resp_bytes: null,
  content_type: null,
  duration_ms: null,
  ua: null,
  accept: null,
  sec_fetch_mode: null,
  referer_host: null,
  conditional: false,
  ip_hash: "d41d8cd98f00b204e9800998ecf8427e",
  asset: false,
};

describe("Event schema", () => {
  it("round-trips a valid event through JSON and back with no loss", () => {
    const parsed = parseEvent(fullEvent);
    const roundTripped = parseEvent(JSON.parse(JSON.stringify(parsed)));
    expect(roundTripped).toEqual(fullEvent);
  });

  it("accepts null for every source-dependent field", () => {
    expect(() => parseEvent(sparseEvent)).not.toThrow();
    expect(parseEvent(JSON.parse(JSON.stringify(sparseEvent)))).toEqual(sparseEvent);
  });

  it("rejects an event with the wrong schema version", () => {
    expect(() => parseEvent({ ...fullEvent, v: 2 })).toThrow();
  });

  it("rejects an event missing a required field", () => {
    const { ip_hash: _omitted, ...withoutIpHash } = fullEvent;
    expect(() => parseEvent(withoutIpHash)).toThrow();
  });

  it("rejects a non-integer timestamp", () => {
    expect(() => parseEvent({ ...fullEvent, ts: 1.5 })).toThrow();
  });

  it("safeParse reports success for a valid event", () => {
    expect(EventSchema.safeParse(fullEvent).success).toBe(true);
  });
});
