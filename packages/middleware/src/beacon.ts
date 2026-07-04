// Server-side status beacons — correct the status the middleware couldn't observe.
// Used in a site's not-found.tsx (404) and instrumentation.ts onRequestError (5xx).
// These run in the app's server runtime (Node), never in the edge middleware.

import type { Correction } from "@footfall/core/ingest";
import { type FootfallConfig, isActive, readConfig } from "./config";
import type { FetchLike } from "./send";

/** POST a status correction. Fire-and-forget: never throws, swallows all failures. */
export async function sendCorrection(
  cfg: FootfallConfig,
  correction: Correction,
  fetchImpl: FetchLike = fetch,
): Promise<boolean> {
  const token = cfg.token;
  if (!isActive(cfg) || !token) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const res = await fetchImpl(cfg.ingestUrl, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ site: token, corrections: [correction] }),
      signal: controller.signal,
      keepalive: true,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    clearTimeout(timer);
    return false;
  }
}

function readHeader(h: Headers | Record<string, string | undefined>, key: string): string | null {
  if (typeof (h as Headers).get === "function") return (h as Headers).get(key);
  return (h as Record<string, string | undefined>)[key] ?? null;
}

// NOTE: a 404 beacon in not-found.tsx was tried and removed. Next renders the
// not-found boundary's body on *every* request in the segment (to establish the RSC
// boundary), not only on real 404s, so a side-effecting beacon there over-fires and
// would mark 200s as 404. Live 404 status is instead resolved by the outside-in probe
// (scripts/probe.ts) and Vercel drain logs. 5xx is reliable via onRequestError below.

/** Call from `instrumentation.ts` `onRequestError` to emit a 5xx correction. */
export async function footfallOnRequestError(
  _error: unknown,
  request: { headers?: Headers | Record<string, string | undefined>; path?: string },
): Promise<void> {
  const cfg = readConfig();
  if (!isActive(cfg) || !request.headers) return;
  const requestId = readHeader(request.headers, "x-footfall-id");
  if (!requestId) return;
  await sendCorrection(cfg, {
    request_id: requestId,
    status: 500,
    path: request.path ?? readHeader(request.headers, "x-footfall-path"),
    ts: Date.now(),
  });
}
