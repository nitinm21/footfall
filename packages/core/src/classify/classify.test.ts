import { describe, expect, it } from "vitest";
import type { Event } from "../schema";
import { sessionize } from "../sessionize";
import { BASE_TS, makeEvent } from "../testkit";
import { classifySession, lookupUa } from "./index";

/** Classify a single synthetic session built from the given events. */
function classifyOne(events: Event[]) {
  const session = sessionize(events)[0];
  if (!session) throw new Error("no session produced");
  return classifySession(session).classification;
}

describe("Tier 1 — UA-exact", () => {
  it("identifies Claude Code", () => {
    const c = classifyOne([makeEvent({ ua: "claude-code/2.1.201" })]);
    expect(c).toMatchObject({ class: "agent", family: "claude-code", tier: 1, confidence: "high" });
  });

  it("identifies Cursor", () => {
    expect(classifyOne([makeEvent({ ua: "Cursor/1.2 (Macintosh)" })]).family).toBe("cursor");
  });

  it("classifies training crawlers as crawler", () => {
    const gpt = classifyOne([
      makeEvent({ ua: "Mozilla/5.0 (compatible; GPTBot/1.1; +https://openai.com/gptbot)" }),
    ]);
    expect(gpt).toMatchObject({ class: "crawler", family: "gptbot", tier: 1 });
    const goog = classifyOne([
      makeEvent({ ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" }),
    ]);
    expect(goog.class).toBe("crawler");
  });

  it("classifies on-behalf fetchers as agents", () => {
    expect(classifyOne([makeEvent({ ua: "Mozilla/5.0 PerplexityBot/1.0" })]).class).toBe("agent");
  });

  it("catches unknown self-declared bots (Tier 1b, generic, medium)", () => {
    const c = classifyOne([makeEvent({ ua: "AcmeDocsBot/1.0 (+https://acme.example/bot)" })]);
    expect(c).toMatchObject({
      class: "crawler",
      family: "generic-bot",
      tier: 1,
      confidence: "medium",
    });
  });
});

describe("Tier 2 — browser", () => {
  it("classifies a Chrome UA as human", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const c = classifyOne([
      makeEvent({ ua, path: "/", sec_fetch_mode: "navigate" }),
      makeEvent({ ua, path: "/app.css", asset: true, ts: BASE_TS + 100 }),
    ]);
    expect(c).toMatchObject({ class: "human", family: "browser", tier: 2, confidence: "high" });
  });
});

describe("Tier 3 — behavioural agent", () => {
  it("classifies a curl-driven, asset-free session as an unidentified agent", () => {
    const ua = "curl/8.1.1";
    const c = classifyOne([
      makeEvent({ ua, path: "/", ts: BASE_TS }),
      makeEvent({ ua, path: "/docs/intro", ts: BASE_TS + 2000 }),
      makeEvent({ ua, path: "/docs/guide", ts: BASE_TS + 4000 }),
    ]);
    expect(c).toMatchObject({
      class: "agent",
      family: "unidentified",
      tier: 3,
      confidence: "medium",
    });
    expect(c.heuristic).toBe(false);
  });

  it("flags a no-UA agent session as codex-suspect (heuristic)", () => {
    const c = classifyOne([
      makeEvent({ ua: null, path: "/", ts: BASE_TS }),
      makeEvent({ ua: null, path: "/docs/intro", ts: BASE_TS + 1500 }),
      makeEvent({ ua: null, path: "/docs/guide", ts: BASE_TS + 3000 }),
    ]);
    expect(c).toMatchObject({ class: "agent", family: "codex-suspect", tier: 3, heuristic: true });
  });
});

describe("never force-assign", () => {
  it("leaves an unknown non-tool client unclassified", () => {
    const c = classifyOne([makeEvent({ ua: "Wharrgarbl/9.0", path: "/" })]);
    expect(c).toMatchObject({ class: "unclassified", family: null, tier: null });
  });
});

describe("receipts", () => {
  it("attaches human-readable signals to every classification", () => {
    const c = classifyOne([makeEvent({ ua: "claude-code/2.1", accept: "text/markdown" })]);
    expect(c.receipt.signals.length).toBeGreaterThan(0);
    expect(c.receipt.signals.some((s) => s.text.includes("user-agent"))).toBe(true);
  });
});

describe("lookupUa", () => {
  it("returns null for unknown UAs and an entry for known ones", () => {
    expect(lookupUa("totally-unknown")).toBeNull();
    expect(lookupUa(null)).toBeNull();
    expect(lookupUa("claude-code/2.1")?.family).toBe("claude-code");
  });
});
