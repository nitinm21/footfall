import type { IngestPayload } from "@footfall/core";
import { type NextFetchEvent, NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";
import type { FootfallConfig } from "./config";
import { buildEvent } from "./event";
import { dailySalt, hashIp } from "./hash";
import { withFootfall } from "./index";
import { Sampler } from "./sampling";
import { sendBatch } from "./send";

const ACTIVE: FootfallConfig = {
  token: "site_test",
  ingestUrl: "https://ingest.example/api/ingest",
  disabled: false,
  ipSalt: "salt",
  dailyCap: 0,
  timeoutMs: 500,
};

/** A NextFetchEvent whose waitUntil collects promises so tests can await capture. */
function fakeEvent() {
  const promises: Promise<unknown>[] = [];
  const ev = { waitUntil: (p: Promise<unknown>) => promises.push(p) } as unknown as NextFetchEvent;
  return { ev, settle: () => Promise.all(promises) };
}

function req(path = "/docs/intro", headers: Record<string, string> = {}) {
  return new NextRequest(`https://site.example${path}`, {
    headers: { "x-forwarded-for": "203.0.113.7", "user-agent": "curl/8", ...headers },
  });
}

describe("invariant: never blocks / modifies / redirects", () => {
  it("default pass-through returns a continue response, not a redirect", async () => {
    const okFetch = vi.fn(async () => new Response(null, { status: 200 }));
    const { ev, settle } = fakeEvent();
    const res = withFootfall(undefined, { config: ACTIVE, fetchImpl: okFetch })(req(), ev);
    const response = (await res) as NextResponse;
    expect(response.headers.get("location")).toBeNull(); // no redirect
    expect(response.status).toBe(200);
    await settle();
  });

  it("returns a wrapped middleware's response unchanged", async () => {
    const okFetch = vi.fn(async () => new Response(null, { status: 200 }));
    const existing = () => NextResponse.redirect(new URL("https://site.example/login"));
    const { ev, settle } = fakeEvent();
    const response = (await withFootfall(existing, { config: ACTIVE, fetchImpl: okFetch })(
      req(),
      ev,
    )) as NextResponse;
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
    await settle();
  });
});

describe("invariant: fail-open send (timeout + one retry, never throws)", () => {
  it("aborts a hung send at the timeout and swallows it", async () => {
    const hung: typeof fetch = (_u, init) =>
      new Promise((_res, rej) =>
        init?.signal?.addEventListener("abort", () => rej(new Error("aborted"))),
      );
    const spy = vi.fn(hung);
    const payload: IngestPayload = { site: "s", events: [] };
    const ok = await sendBatch("https://x", "t", payload, 40, spy);
    expect(ok).toBe(false); // swallowed, no throw
    expect(spy).toHaveBeenCalledTimes(2); // one retry
  });

  it("retries once on error then gives up, and returns true on success", async () => {
    const err = vi.fn(async () => {
      throw new Error("network");
    });
    expect(await sendBatch("https://x", "t", { site: "s" }, 50, err)).toBe(false);
    expect(err).toHaveBeenCalledTimes(2);

    const ok = vi.fn(async () => new Response(null, { status: 202 }));
    expect(await sendBatch("https://x", "t", { site: "s" }, 50, ok)).toBe(true);
    expect(ok).toHaveBeenCalledTimes(1);
  });
});

describe("invariant: kill switch / inactivity → zero emission", () => {
  it("does not call fetch when disabled", async () => {
    const spy = vi.fn(async () => new Response(null, { status: 200 }));
    const { ev, settle } = fakeEvent();
    await withFootfall(undefined, { config: { ...ACTIVE, disabled: true }, fetchImpl: spy })(
      req(),
      ev,
    );
    await settle();
    expect(spy).not.toHaveBeenCalled();
  });

  it("does not call fetch when no token is configured", async () => {
    const spy = vi.fn(async () => new Response(null, { status: 200 }));
    const { ev, settle } = fakeEvent();
    await withFootfall(undefined, { config: { ...ACTIVE, token: null }, fetchImpl: spy })(
      req(),
      ev,
    );
    await settle();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("invariant: emits a valid event (hashed IP, no raw IP, status null)", () => {
  it("captures and POSTs a schema-shaped event", async () => {
    const sent: IngestPayload[] = [];
    const spy: typeof fetch = async (_u, init) => {
      sent.push(JSON.parse(String(init?.body)) as IngestPayload);
      return new Response(null, { status: 200 });
    };
    const { ev, settle } = fakeEvent();
    await withFootfall(undefined, { config: ACTIVE, fetchImpl: spy, now: () => 1_751_000_000_000 })(
      req(),
      ev,
    );
    await settle();
    const event = sent[0]?.events?.[0];
    expect(event?.path).toBe("/docs/intro");
    expect(event?.status).toBeNull(); // middleware can't see status
    expect(event?.ip_hash).toHaveLength(32);
    expect(event?.request_id).toBeTruthy();
    expect(JSON.stringify(sent[0])).not.toContain("203.0.113.7"); // raw IP never serialized
  });
});

describe("hashIp: daily-rotating salt", () => {
  it("is stable within a day and differs across days", async () => {
    const d1 = 1_751_000_000_000;
    const d2 = d1 + 24 * 60 * 60 * 1000;
    const a = await hashIp("1.2.3.4", "salt", d1);
    const b = await hashIp("1.2.3.4", "salt", d1);
    const c = await hashIp("1.2.3.4", "salt", d2);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toContain("1.2.3.4");
    expect(dailySalt("salt", d1)).not.toBe(dailySalt("salt", d2));
  });
});

describe("Sampler: daily cap with visible drops", () => {
  it("emits under the cap and samples above it, never losing the drop count", () => {
    const s = new Sampler(2, 3); // cap 2, keep 1 in 3 above cap
    const t = 1_751_000_000_000;
    expect(s.next(t)).toEqual({ emit: true, dropped: 0 }); // 1
    expect(s.next(t)).toEqual({ emit: true, dropped: 0 }); // 2 (== cap)
    expect(s.next(t)).toEqual({ emit: false, dropped: 0 }); // 3 over(1)
    expect(s.next(t)).toEqual({ emit: false, dropped: 0 }); // 4 over(2)
    expect(s.next(t)).toEqual({ emit: true, dropped: 2 }); // 5 over(3)%3==0 → emit, reports 2 drops
  });

  it("resets on a new day", () => {
    const s = new Sampler(1);
    const day1 = 1_751_000_000_000;
    const day2 = day1 + 24 * 60 * 60 * 1000;
    expect(s.next(day1).emit).toBe(true);
    expect(s.next(day1).emit).toBe(false); // over cap
    expect(s.next(day2).emit).toBe(true); // new day → reset
  });
});

describe("buildEvent", () => {
  it("extracts fields and never includes the raw IP", async () => {
    const event = await buildEvent(req("/a?x=1", { accept: "text/markdown" }), {
      site: "s",
      ipSalt: "salt",
      nowMs: 1_751_000_000_000,
    });
    expect(event).toMatchObject({
      path: "/a",
      has_query: true,
      status: null,
      accept: "text/markdown",
    });
    expect(JSON.stringify(event)).not.toContain("203.0.113.7");
  });
});
