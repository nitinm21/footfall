// Test-only helpers (not exported from the package barrel).

import { EVENT_VERSION, type Event } from "./schema";

const BASE_TS = 1_751_500_000_000;

/** Build a valid Event with sensible defaults; override any field. */
export function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    v: EVENT_VERSION,
    ts: BASE_TS,
    site: "site-test",
    method: "GET",
    path: "/",
    has_query: false,
    status: 200,
    resp_bytes: 5000,
    content_type: "text/html; charset=utf-8",
    duration_ms: 20,
    ua: null,
    accept: null,
    sec_fetch_mode: null,
    referer_host: null,
    conditional: false,
    ip_hash: "iphash-a",
    asset: false,
    ...overrides,
  };
}

export { BASE_TS };
