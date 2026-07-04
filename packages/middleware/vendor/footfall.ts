// footfall.ts — self-contained, vendored Footfall middleware (no dependencies).
//
// Drop this one file into your Next.js repo (e.g. at the project root or in lib/),
// then create a middleware.ts that re-exports withFootfall() (see middleware.example.ts).
// Observe-only + fail-open: it never blocks, modifies, or delays a response; all capture
// happens in event.waitUntil with a hard timeout, so ingest health can't affect your site.
//
// Config is env-vars only:
//   FOOTFALL_TOKEN        your site id (e.g. "nitinmurali.vercel.app"); no token => inert
//   FOOTFALL_INGEST_URL   https://footfall-phi.vercel.app/api/ingest
//   FOOTFALL_IP_SALT      any random string (rotate-friendly; hashes the IP)
//   FOOTFALL_DISABLED     set to "1" to kill emission
//
// This is a temporary vendored copy until @footfall/next is published to npm (Phase 8).

import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

const EVENT_VERSION = 1;
const TIMEOUT_MS = 500;

interface Config {
  token: string | null;
  ingestUrl: string;
  disabled: boolean;
  ipSalt: string;
  dailyCap: number;
}

function readConfig(): Config {
  const env = process.env;
  const d = env.FOOTFALL_DISABLED;
  return {
    token: env.FOOTFALL_TOKEN ?? null,
    ingestUrl: env.FOOTFALL_INGEST_URL ?? "",
    disabled: d === "1" || d === "true",
    ipSalt: env.FOOTFALL_IP_SALT ?? "footfall",
    dailyCap: Number.parseInt(env.FOOTFALL_DAILY_CAP ?? "0", 10) || 0,
  };
}

function isActive(c: Config): boolean {
  return !c.disabled && !!c.token && c.ingestUrl !== "";
}

async function hashIp(ip: string, saltBase: string, nowMs: number): Promise<string> {
  const day = new Date(nowMs).toISOString().slice(0, 10);
  const data = new TextEncoder().encode(`${saltBase}:${day}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  let hex = "";
  for (const b of new Uint8Array(digest)) hex += b.toString(16).padStart(2, "0");
  return hex.slice(0, 32);
}

const ASSET_EXT = /\.(css|js|mjs|map|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot)$/i;

// Best-effort per-instance daily cap; dropped counts ride the next emitted batch.
let day = "";
let count = 0;
let dropped = 0;
function sample(cap: number, nowMs: number): { emit: boolean; dropped: number } {
  const d = new Date(nowMs).toISOString().slice(0, 10);
  if (d !== day) {
    day = d;
    count = 0;
    dropped = 0;
  }
  count += 1;
  if (cap <= 0 || count <= cap) {
    const drops = dropped;
    dropped = 0;
    return { emit: true, dropped: drops };
  }
  if ((count - cap) % 10 === 0) {
    const drops = dropped;
    dropped = 0;
    return { emit: true, dropped: drops };
  }
  dropped += 1;
  return { emit: false, dropped: 0 };
}

async function send(url: string, token: string, body: string): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body,
        signal: controller.signal,
        keepalive: true,
      });
      clearTimeout(timer);
      if (res.ok) return;
    } catch {
      clearTimeout(timer);
    }
  }
}

type MiddlewareFn = (
  req: NextRequest,
  ev: NextFetchEvent,
) => Response | Promise<Response | undefined> | undefined;

/** Wrap your middleware (or nothing) with observe-only Footfall capture. */
export function withFootfall(existing?: MiddlewareFn): MiddlewareFn {
  const cfg = readConfig();
  return (req, ev) => {
    if (!isActive(cfg) || !cfg.token) return existing ? existing(req, ev) : undefined;
    const token = cfg.token;
    const requestId = crypto.randomUUID();
    const nowMs = Date.now();
    const decision = sample(cfg.dailyCap, nowMs);

    if (decision.emit) {
      ev.waitUntil(
        (async () => {
          try {
            const url = new URL(req.url);
            const h = req.headers;
            const xff = h.get("x-forwarded-for");
            const ip = (xff ? xff.split(",")[0]?.trim() : null) || h.get("x-real-ip") || "unknown";
            let refererHost: string | null = null;
            const ref = h.get("referer");
            if (ref) {
              try {
                refererHost = new URL(ref).host;
              } catch {}
            }
            const event = {
              v: EVENT_VERSION,
              ts: nowMs,
              site: token,
              method: req.method,
              path: url.pathname,
              has_query: url.search !== "",
              status: null,
              resp_bytes: null,
              content_type: null,
              duration_ms: null,
              ua: h.get("user-agent"),
              accept: h.get("accept"),
              sec_fetch_mode: h.get("sec-fetch-mode"),
              referer_host: refererHost,
              conditional: h.has("if-none-match") || h.has("if-modified-since"),
              ip_hash: await hashIp(ip, cfg.ipSalt, nowMs),
              asset: url.pathname.startsWith("/_next/static") || ASSET_EXT.test(url.pathname),
              request_id: requestId,
            };
            await send(
              cfg.ingestUrl,
              token,
              JSON.stringify({ site: token, events: [event], dropped: decision.dropped }),
            );
          } catch {
            // observe-only: never surface capture errors
          }
        })(),
      );
    }

    if (existing) return existing(req, ev);
    const headers = new Headers(req.headers);
    headers.set("x-footfall-id", requestId);
    return NextResponse.next({ request: { headers } });
  };
}
