import { describe, expect, it } from "vitest";
import { EVENT_VERSION } from "../schema";
import { normalizeJsonl } from "./jsonl";
import { normalizeVercelDrain } from "./vercel-drain";

describe("normalizeJsonl", () => {
  it("parses valid rows, skips blanks, and collects malformed rows", () => {
    const good = JSON.stringify({
      v: EVENT_VERSION,
      ts: 1,
      site: "s",
      method: "GET",
      path: "/",
      has_query: false,
      status: 200,
      resp_bytes: 1,
      content_type: null,
      duration_ms: null,
      ua: null,
      accept: null,
      sec_fetch_mode: null,
      referer_host: null,
      conditional: false,
      ip_hash: "h",
      asset: false,
    });
    const text = `${good}\n\n{"not":"an event"}\nnot json at all`;
    const result = normalizeJsonl(text);
    expect(result.events).toHaveLength(1);
    expect(result.errors).toHaveLength(2);
    expect(result.fieldMap.source).toBe("jsonl");
  });
});

describe("normalizeVercelDrain", () => {
  const sample = JSON.stringify([
    {
      timestamp: 1_751_500_000_000,
      proxy: {
        timestamp: 1_751_500_000_000,
        method: "GET",
        path: "/docs/intro?ref=x",
        statusCode: 200,
        userAgent: ["Mozilla/5.0 (compatible; GPTBot/1.1)"],
        referer: "https://www.google.com/search",
        clientIp: "1.2.3.4",
        responseByteSize: 5120,
      },
    },
    {
      proxy: {
        method: "GET",
        path: "/app.css",
        statusCode: 200,
        userAgent: "Mozilla/5.0",
        clientIp: "1.2.3.4",
      },
    },
    { source: "build", message: "building…" }, // not a request → skipped
  ]);

  it("maps proxy records to Events and drops non-request logs", () => {
    const { events, fieldMap } = normalizeVercelDrain(sample, { site: "modelkit.dev", salt: "t" });
    expect(events).toHaveLength(2);
    const [page, css] = events;
    expect(page).toMatchObject({
      site: "modelkit.dev",
      path: "/docs/intro",
      has_query: true,
      status: 200,
      resp_bytes: 5120,
      referer_host: "www.google.com",
      content_type: null,
      asset: false,
    });
    expect(page?.ua).toContain("GPTBot");
    expect(page?.ip_hash).toHaveLength(32);
    expect(css?.asset).toBe(true);
    expect(css?.resp_bytes).toBeNull();
    expect(fieldMap.source).toBe("vercel-drain");
    expect(fieldMap.fields).not.toContain("accept");
  });

  it("hashes the client IP (never stores it raw)", () => {
    const { events } = normalizeVercelDrain(sample, { site: "s", salt: "t" });
    expect(events[0]?.ip_hash).not.toBe("1.2.3.4");
  });
});
