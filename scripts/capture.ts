/**
 * capture.ts — the recording reverse proxy (Phase 1).
 *
 * A tiny local proxy that sits in front of `apps/target` and records the full
 * request AND response (status, bytes, content-type, timing) of every request as
 * schema-valid Event JSONL. We use a proxy — not Next middleware — because Next
 * middleware runs before the route renders and cannot see the response; locally we
 * want full-fidelity ground truth.
 *
 * Usage:
 *   FOOTFALL_CAPTURE_OUT=fixtures/traces/crawler/run-01.jsonl \
 *     pnpm capture [--target http://localhost:3000] [--port 4000] [--site target-local]
 *
 * Point your client (agent CLI, browser, curl) at http://localhost:<port>/ and the
 * proxy forwards to <target>, appending one Event per request to the OUT file.
 * Ctrl-C to stop; it prints a summary of what it captured.
 */

import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { dirname } from "node:path";
import { EVENT_VERSION, type Event, EventSchema } from "@footfall/core";

function arg(flag: string, fallback: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? (process.argv[i + 1] as string) : fallback;
}

const OUT = process.env.FOOTFALL_CAPTURE_OUT ?? arg("--out", "");
if (!OUT) {
  console.error("capture: set FOOTFALL_CAPTURE_OUT (or --out <file>) to the output JSONL path");
  process.exit(1);
}
const TARGET = new URL(
  process.env.FOOTFALL_CAPTURE_TARGET ?? arg("--target", "http://localhost:3000"),
);
const PORT = Number(process.env.FOOTFALL_CAPTURE_PORT ?? arg("--port", "4000"));
const SITE = process.env.FOOTFALL_CAPTURE_SITE ?? arg("--site", "target-local");

mkdirSync(dirname(OUT), { recursive: true });

/** Daily-rotating salted IP hash — session stitching without retaining the raw IP. */
function hashIp(ip: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(`${day}:${ip}`).digest("hex").slice(0, 32);
}

const ASSET_EXT = /\.(css|js|mjs|map|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot)$/i;
function isAsset(path: string, contentType: string | null): boolean {
  if (path.startsWith("/_next/static")) return true;
  if (ASSET_EXT.test(path)) return true;
  if (contentType) {
    return /^(text\/css|application\/javascript|font\/|image\/)/.test(contentType);
  }
  return false;
}

function header(value: string | string[] | undefined): string | null {
  if (value === undefined) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function refererHost(referer: string | null): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).host;
  } catch {
    return null;
  }
}

let count = 0;

const server = createServer((clientReq, clientRes) => {
  const started = process.hrtime.bigint();
  const rawUrl = clientReq.url ?? "/";
  const qIndex = rawUrl.indexOf("?");
  const path = qIndex >= 0 ? rawUrl.slice(0, qIndex) : rawUrl;
  const hasQuery = qIndex >= 0;

  const h = clientReq.headers;
  const remoteIp = clientReq.socket.remoteAddress ?? "unknown";

  const upstream = httpRequest(
    {
      hostname: TARGET.hostname,
      port: TARGET.port || 80,
      path: rawUrl,
      method: clientReq.method,
      headers: { ...clientReq.headers, host: TARGET.host },
    },
    (upRes) => {
      const contentType = header(upRes.headers["content-type"]);
      let bytes = 0;
      upRes.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
      });
      upRes.on("end", () => {
        const durationMs = Number((process.hrtime.bigint() - started) / 1000n) / 1000;
        const event: Event = {
          v: EVENT_VERSION,
          ts: Date.now(),
          site: SITE,
          method: clientReq.method ?? "GET",
          path,
          has_query: hasQuery,
          status: upRes.statusCode ?? null,
          resp_bytes: bytes,
          content_type: contentType,
          duration_ms: Math.round(durationMs),
          ua: header(h["user-agent"]),
          accept: header(h.accept),
          sec_fetch_mode: header(h["sec-fetch-mode"]),
          referer_host: refererHost(header(h.referer)),
          conditional: "if-none-match" in h || "if-modified-since" in h,
          ip_hash: hashIp(remoteIp),
          asset: isAsset(path, contentType),
        };
        // Validate before persisting so the corpus is schema-clean by construction.
        appendFileSync(OUT, `${JSON.stringify(EventSchema.parse(event))}\n`);
        count += 1;
      });

      clientRes.writeHead(upRes.statusCode ?? 502, upRes.headers);
      upRes.pipe(clientRes);
    },
  );

  upstream.on("error", (err) => {
    console.error(`capture: upstream error for ${rawUrl}:`, err.message);
    if (!clientRes.headersSent) clientRes.writeHead(502);
    clientRes.end("Bad gateway (capture proxy)");
  });

  clientReq.pipe(upstream);
});

server.listen(PORT, () => {
  console.log(`capture: proxying http://localhost:${PORT}  ->  ${TARGET.origin}`);
  console.log(`capture: writing events to ${OUT} (site="${SITE}")`);
  console.log("capture: drive your client at the proxy URL, then Ctrl-C to stop.");
});

function shutdown(): void {
  console.log(`\ncapture: recorded ${count} event(s) to ${OUT}`);
  server.close(() => process.exit(0));
  // Force-exit if sockets linger.
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
