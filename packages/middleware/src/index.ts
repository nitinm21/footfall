// @footfall/next — observe-only, fail-open Next.js middleware.
// Invariants (each has a test): never blocks/modifies/redirects the response · hard
// timeout + swallow on the send · per-instance daily cap with visible drops · IP hashed
// (daily salt) before leaving the edge · env-var config incl. a kill switch.

import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { type FootfallConfig, isActive, readConfig } from "./config";
import { buildEvent } from "./event";
import { Sampler } from "./sampling";
import { sendBatch } from "./send";

export { footfallOnRequestError, sendCorrection } from "./beacon";
export { type FootfallConfig, isActive, readConfig } from "./config";
export { buildEvent } from "./event";
export { dailySalt, hashIp } from "./hash";
export { Sampler } from "./sampling";
export { type FetchLike, sendBatch } from "./send";

/** A Next.js middleware function (what `middleware.ts` exports). */
export type MiddlewareFn = (
  req: NextRequest,
  ev: NextFetchEvent,
) => Response | Promise<Response | undefined> | undefined;

export interface WithFootfallOptions {
  /** Override env config (mainly for tests). */
  config?: FootfallConfig;
  /** Inject fetch (mainly for tests). */
  fetchImpl?: typeof fetch;
  /** Inject the clock (mainly for tests). */
  now?: () => number;
}

/**
 * Wrap a site's middleware (or nothing) with observe-only event capture. The wrapped
 * middleware's response is returned unchanged; capture happens in `event.waitUntil`,
 * so ingest health can never affect the site.
 */
export function withFootfall(
  existing?: MiddlewareFn,
  opts: WithFootfallOptions = {},
): MiddlewareFn {
  const cfg = opts.config ?? readConfig();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? Date.now;
  const sampler = new Sampler(cfg.dailyCap);
  const token = cfg.token;

  return (req, ev) => {
    // Passive path: run the wrapped middleware (or continue) with the correlation id
    // stamped on the *request* headers so server-side beacons can match a status later.
    if (!isActive(cfg) || !token) {
      return existing ? existing(req, ev) : undefined;
    }

    const requestId = crypto.randomUUID();
    const nowMs = now();
    const decision = sampler.next(nowMs);

    if (decision.emit) {
      const capture = (async () => {
        try {
          const event = await buildEvent(req, { site: token, ipSalt: cfg.ipSalt, nowMs });
          event.request_id = requestId;
          await sendBatch(
            cfg.ingestUrl,
            token,
            { site: token, events: [event], dropped: decision.dropped },
            cfg.timeoutMs,
            fetchImpl,
          );
        } catch {
          // observe-only: never surface capture errors
        }
      })();
      ev.waitUntil(capture);
    }

    if (existing) return existing(req, ev);

    // Default pass-through: continue to the route, forwarding the correlation headers.
    const headers = new Headers(req.headers);
    headers.set("x-footfall-id", requestId);
    headers.set("x-footfall-path", new URL(req.url).pathname);
    return NextResponse.next({ request: { headers } });
  };
}
