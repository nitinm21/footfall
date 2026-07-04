import { describe, expect, it } from "vitest";
import { SESSION_GAP_MS, sessionize, uaFingerprint } from "./sessionize";
import { BASE_TS, makeEvent } from "./testkit";

describe("sessionize", () => {
  it("groups contiguous same-key requests into one session", () => {
    const events = [
      makeEvent({ ts: BASE_TS, path: "/a", ua: "curl/8" }),
      makeEvent({ ts: BASE_TS + 5000, path: "/b", ua: "curl/8" }),
      makeEvent({ ts: BASE_TS + 10000, path: "/c", ua: "curl/8" }),
    ];
    const sessions = sessionize(events);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.events).toHaveLength(3);
    expect(sessions[0]?.start).toBe(BASE_TS);
    expect(sessions[0]?.end).toBe(BASE_TS + 10000);
  });

  it("splits into a new session when the gap reaches 15 minutes", () => {
    const events = [
      makeEvent({ ts: BASE_TS, ua: "curl/8" }),
      makeEvent({ ts: BASE_TS + SESSION_GAP_MS, ua: "curl/8" }),
    ];
    expect(sessionize(events)).toHaveLength(2);
  });

  it("separates sessions by ua fingerprint and ip_hash", () => {
    const events = [
      makeEvent({ ua: "curl/8", ip_hash: "a" }),
      makeEvent({ ua: "Mozilla/5.0", ip_hash: "a" }),
      makeEvent({ ua: "curl/8", ip_hash: "b" }),
    ];
    expect(sessionize(events)).toHaveLength(3);
  });

  it("produces deterministic ids and sorts by start", () => {
    const a = sessionize([makeEvent({ ua: "curl/8" })]);
    const b = sessionize([makeEvent({ ua: "curl/8" })]);
    expect(a[0]?.id).toBe(b[0]?.id);
  });

  it("fingerprints missing UA as no-ua", () => {
    expect(uaFingerprint(null)).toBe("no-ua");
    expect(uaFingerprint("  ")).toBe("no-ua");
    expect(uaFingerprint("curl/8")).toBe("curl/8");
  });
});
