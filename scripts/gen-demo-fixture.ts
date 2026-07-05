/**
 * Generates the seeded demo dataset (fixtures/demo/dashboard-demo.jsonl). This is *sample* data
 * for the demo/public dashboard — the mock itself is labelled fictional — so it is synthetic, but
 * it is generated deterministically (fixed anchor, seeded PRNG; no Date.now / Math.random) so the
 * file is reproducible and reviewable, and the dashboard's numbers-parity test is stable.
 *
 * It bakes the mock's story: a /llms.txt 404 wall that flips to 200 on a fixed "fix" day, plus
 * persistent /openapi.json 404s, an /api/keys auth wall, a /playground empty shell, a retry loop,
 * and a Cursor-impersonating-Googlebot spoof (the Phase 4.5 finding).
 *
 *   pnpm tsx scripts/gen-demo-fixture.ts   # regenerate after editing this file
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EVENT_VERSION, type Event } from "@footfall/core/schema";

const SITE = "demo";
const DAY = 86_400_000;
const DAYS = 28;
const START = Date.UTC(2026, 5, 17); // 2026-06-17; day 27 = 2026-07-14
const FIX_DAY = 21; // /llms.txt ships 2026-07-08 (inside the current 14-day window)
const FIX_TS = START + FIX_DAY * DAY;

// Deterministic PRNG (mulberry32) — no Math.random, so the fixture is byte-reproducible.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(0x1000f00d);
const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)] as T;
const between = (lo: number, hi: number): number => lo + Math.floor(rand() * (hi - lo + 1));
/** n distinct items (deterministic shuffle) — agents read distinct pages, not retry loops. */
function pickN<T>(xs: T[], n: number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a.slice(0, Math.min(n, a.length));
}

const events: Event[] = [];
let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `iph-${ipCounter.toString(36)}`;
}

const PAGES = [
  "/docs/quickstart",
  "/docs/api/chat",
  "/docs/api/embeddings",
  "/docs/errors",
  "/changelog",
  "/pricing",
];
const ASSETS = [
  "/_next/static/app.css",
  "/_next/static/app.js",
  "/favicon.ico",
  "/logo.svg",
  "/fonts/inter.woff2",
];

function ev(o: Partial<Event> & { ts: number; path: string; ip_hash: string }): Event {
  return {
    v: EVENT_VERSION,
    site: SITE,
    method: "GET",
    has_query: false,
    status: 200,
    resp_bytes: between(3200, 9000),
    content_type: "text/html; charset=utf-8",
    duration_ms: between(8, 60),
    ua: null,
    accept: null,
    sec_fetch_mode: null,
    referer_host: null,
    conditional: false,
    asset: false,
    ...o,
  };
}

// llms.txt is a 404 before the fix ships, then 200 after — the fix-impact story.
function llmsStatus(ts: number): number {
  return ts >= FIX_TS ? 200 : 404;
}

function humanSession(dayTs: number): void {
  const ip = nextIp();
  let t = dayTs + between(8, 20) * 3_600_000;
  const ua =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
  const landing = pick(PAGES);
  events.push(
    ev({ ts: t, path: landing, ip_hash: ip, ua, accept: "text/html", sec_fetch_mode: "navigate" }),
  );
  for (const a of ASSETS) {
    t += between(30, 400);
    events.push(
      ev({
        ts: t,
        path: a,
        ip_hash: ip,
        ua,
        asset: true,
        accept: "*/*",
        sec_fetch_mode: "no-cors",
        content_type: a.endsWith(".css")
          ? "text/css"
          : a.endsWith(".js")
            ? "application/javascript"
            : "image/svg+xml",
      }),
    );
  }
  const extra = between(1, 3);
  for (let i = 0; i < extra; i++) {
    t += between(2000, 40_000);
    events.push(
      ev({
        ts: t,
        path: pick(PAGES),
        ip_hash: ip,
        ua,
        accept: "text/html",
        sec_fetch_mode: "navigate",
      }),
    );
  }
}

function claudeCodeSession(dayTs: number): void {
  const ip = nextIp();
  let t = dayTs + between(0, 23) * 3_600_000;
  const ua = "Claude-User (claude-code/2.1.201; +https://claude.com/claude-code)";
  const paths = pickN(PAGES, between(3, 5));
  for (const p of paths) {
    t += between(1500, 9000);
    events.push(
      ev({
        ts: t,
        path: p,
        ip_hash: ip,
        ua,
        accept: "text/markdown, text/html",
        conditional: rand() > 0.5,
      }),
    );
  }
  // agent-demand fetches that dead-end
  t += between(1500, 6000);
  events.push(
    ev({
      ts: t,
      path: "/llms.txt",
      ip_hash: ip,
      ua,
      accept: "text/markdown",
      status: llmsStatus(t),
      // markdown/plain, not html → a legit small text file, not an empty HTML shell
      content_type: "text/markdown; charset=utf-8",
      resp_bytes: llmsStatus(t) === 200 ? 1400 : 0,
    }),
  );
  t += between(1500, 6000);
  events.push(
    ev({
      ts: t,
      path: "/docs/api/chat.md",
      ip_hash: ip,
      ua,
      accept: "text/markdown",
      status: 404,
      resp_bytes: 0,
    }),
  );
}

function cursorSession(dayTs: number): void {
  const ip = nextIp();
  let t = dayTs + between(0, 23) * 3_600_000;
  const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Cursor/1.4.2 Chrome/126.0";
  for (const p of pickN(PAGES, between(2, 4))) {
    t += between(1000, 8000);
    events.push(
      ev({ ts: t, path: p, ip_hash: ip, ua, accept: "text/html", conditional: rand() > 0.6 }),
    );
  }
  if (rand() > 0.5) {
    t += between(1000, 5000);
    events.push(
      ev({
        ts: t,
        path: "/_next/static/app.js",
        ip_hash: ip,
        ua,
        asset: true,
        content_type: "application/javascript",
      }),
    );
  }
}

function codexSuspectSession(dayTs: number): void {
  const ip = nextIp();
  let t = dayTs + between(0, 23) * 3_600_000;
  // No UA — Codex's shell path is anonymous; behavioural classification catches it.
  for (const p of pickN(PAGES, between(4, 6))) {
    t += between(800, 5000);
    events.push(
      ev({ ts: t, path: p, ip_hash: ip, ua: null, accept: "text/markdown", conditional: true }),
    );
  }
  t += between(800, 3000);
  events.push(
    ev({
      ts: t,
      path: "/openapi.json",
      ip_hash: ip,
      ua: null,
      accept: "application/json",
      status: 404,
      resp_bytes: 0,
    }),
  );
}

function spoofedGooglebotSession(dayTs: number): void {
  const ip = nextIp();
  let t = dayTs + between(0, 23) * 3_600_000;
  // Cursor impersonating Googlebot from a non-Google IP (Phase 4.5 finding) → spoofed.
  const ua = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
  const n = between(2, 4);
  for (let i = 0; i < n; i++) {
    t += between(1000, 6000);
    events.push(
      ev({
        ts: t,
        path: pick(PAGES),
        ip_hash: ip,
        ua,
        bot_verified: "spoofed",
        accept: "text/html",
      }),
    );
  }
}

function realGooglebotSession(dayTs: number): void {
  const ip = nextIp();
  let t = dayTs + between(0, 23) * 3_600_000;
  const ua = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
  const n = between(2, 5);
  for (let i = 0; i < n; i++) {
    t += between(2000, 30_000);
    events.push(
      ev({
        ts: t,
        path: pick([...PAGES, "/", "/sitemap.xml"]),
        ip_hash: ip,
        ua,
        bot_verified: "verified",
      }),
    );
  }
}

function retryLoopSession(dayTs: number): void {
  const ip = nextIp();
  let t = dayTs + between(0, 23) * 3_600_000;
  const ua = "Claude-User (claude-code/2.1.201)";
  for (let i = 0; i < 4; i++) {
    t += between(3000, 12_000); // ≥3 identical fetches within 60s
    events.push(
      ev({
        ts: t,
        path: "/openapi.json",
        ip_hash: ip,
        ua,
        accept: "application/json",
        status: 404,
        resp_bytes: 0,
      }),
    );
  }
}

function authWallSession(dayTs: number): void {
  const ip = nextIp();
  let t = dayTs + between(0, 23) * 3_600_000;
  const ua = "Mozilla/5.0 (Macintosh) Cursor/1.4.2 Chrome/126.0";
  events.push(ev({ ts: t, path: "/docs/api/chat", ip_hash: ip, ua, accept: "text/html" }));
  t += between(1000, 5000);
  events.push(
    ev({
      ts: t,
      path: "/api/keys",
      ip_hash: ip,
      ua,
      accept: "application/json",
      status: 401,
      resp_bytes: 0,
    }),
  );
}

function emptyShellSession(dayTs: number): void {
  const ip = nextIp();
  let t = dayTs + between(0, 23) * 3_600_000;
  const ua = "Claude-User (claude-code/2.1.201)";
  events.push(ev({ ts: t, path: "/docs/quickstart", ip_hash: ip, ua, accept: "text/markdown" }));
  t += between(1000, 5000);
  // 200 + html but tiny body → empty-shell heuristic (resp_bytes < 3072).
  events.push(
    ev({
      ts: t,
      path: "/playground",
      ip_hash: ip,
      ua,
      accept: "text/html",
      status: 200,
      resp_bytes: 800,
    }),
  );
}

for (let d = 0; d < DAYS; d++) {
  const dayTs = START + d * DAY;
  const weekday = new Date(dayTs).getUTCDay();
  const isWeekend = weekday === 0 || weekday === 6;

  for (let i = 0; i < (isWeekend ? 3 : 6); i++) humanSession(dayTs);
  for (let i = 0; i < 3; i++) claudeCodeSession(dayTs);
  for (let i = 0; i < 2; i++) cursorSession(dayTs);
  for (let i = 0; i < 2; i++) codexSuspectSession(dayTs);
  realGooglebotSession(dayTs);
  if (d % 3 === 0) spoofedGooglebotSession(dayTs);
  if (d % 4 === 0) retryLoopSession(dayTs);
  authWallSession(dayTs);
  if (d % 2 === 0) emptyShellSession(dayTs);
}

events.sort((a, b) => a.ts - b.ts);

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "demo");
mkdirSync(outDir, { recursive: true });
const out = join(outDir, "dashboard-demo.jsonl");
writeFileSync(out, `${events.map((e) => JSON.stringify(e)).join("\n")}\n`);
console.log(
  `wrote ${events.length} events → fixtures/demo/dashboard-demo.jsonl (${DAYS} days, fix day ${FIX_DAY})`,
);
