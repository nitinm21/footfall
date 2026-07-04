// Narrow subpath import: keep node:crypto (in core's barrel) out of the edge bundle.
import { EVENT_VERSION, type Event } from "@footfall/core/schema";
import { hashIp } from "./hash";

const ASSET_EXT = /\.(css|js|mjs|map|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot)$/i;
function isAsset(path: string): boolean {
  return path.startsWith("/_next/static") || ASSET_EXT.test(path);
}

function firstForwardedIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return headers.get("x-real-ip") ?? "unknown";
}

function refererHost(referer: string | null): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).host;
  } catch {
    return null;
  }
}

/**
 * Build an Event from a request. Middleware runs before the response, so `status`,
 * `resp_bytes`, `content_type`, and `duration_ms` are null here — they're filled by
 * server-side beacons (404/5xx) or left for the coverage matrix to handle.
 */
export async function buildEvent(
  req: Request,
  opts: { site: string; ipSalt: string; nowMs: number },
): Promise<Event> {
  const url = new URL(req.url);
  const h = req.headers;
  const ip = firstForwardedIp(h);
  return {
    v: EVENT_VERSION,
    ts: opts.nowMs,
    site: opts.site,
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
    referer_host: refererHost(h.get("referer")),
    conditional: h.has("if-none-match") || h.has("if-modified-since"),
    ip_hash: await hashIp(ip, opts.ipSalt, opts.nowMs),
    asset: isAsset(url.pathname),
  };
}
