import { hashIp } from "../hash";
import { EVENT_VERSION, type Event, EventSchema } from "../schema";
import type { FieldMap } from "./field-map";
import type { NormalizeResult } from "./jsonl";

/**
 * Vercel log drains carry request metadata but not response bytes' content-type,
 * timing, Accept, or conditional headers — so those grey out in the coverage matrix.
 * (This mirrors the mock's "Cloudflare Logpush" coverage: bytes present; accept,
 * conditional, timing, real-time missing.)
 */
export const vercelDrainFieldMap: FieldMap = {
  source: "vercel-drain",
  realtime: false,
  fields: [
    "v",
    "ts",
    "site",
    "method",
    "path",
    "has_query",
    "status",
    "resp_bytes",
    "ua",
    "referer_host",
    "ip_hash",
    "asset",
  ],
};

const ASSET_EXT = /\.(css|js|mjs|map|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot)$/i;
function deriveAsset(path: string): boolean {
  return path.startsWith("/_next/static") || ASSET_EXT.test(path);
}

function firstString(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return null;
}

function refererHost(referer: string | null): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).host;
  } catch {
    return null;
  }
}

type Json = Record<string, unknown>;
function asObject(v: unknown): Json | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null;
}

/** Parse one drain record (request logs carry a `proxy` sub-object). */
function toEvent(record: Json, site: string, salt: string): Event | null {
  const proxy = asObject(record.proxy) ?? record;
  const method = firstString(proxy.method);
  const rawPath = firstString(proxy.path);
  const status = typeof proxy.statusCode === "number" ? proxy.statusCode : null;
  if (!method || !rawPath) return null; // not a request log (build/static/etc.)

  const qIndex = rawPath.indexOf("?");
  const path = qIndex >= 0 ? rawPath.slice(0, qIndex) : rawPath;
  const ts =
    typeof proxy.timestamp === "number"
      ? proxy.timestamp
      : typeof record.timestamp === "number"
        ? record.timestamp
        : 0;
  const clientIp = firstString(proxy.clientIp) ?? "unknown";
  const respBytes = typeof proxy.responseByteSize === "number" ? proxy.responseByteSize : null;

  const candidate = {
    v: EVENT_VERSION,
    ts,
    site,
    method,
    path,
    has_query: qIndex >= 0,
    status,
    resp_bytes: respBytes,
    content_type: null,
    duration_ms: null,
    ua: firstString(proxy.userAgent),
    accept: null,
    sec_fetch_mode: null,
    referer_host: refererHost(firstString(proxy.referer)),
    conditional: false,
    ip_hash: hashIp(clientIp, salt),
    asset: deriveAsset(path),
  };
  const parsed = EventSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export interface VercelDrainOptions {
  /** Site token to stamp on every event (a drain has no Footfall token of its own). */
  site: string;
  /** Salt for hashing the client IP (batch runs; not the daily-rotating edge salt). */
  salt?: string;
}

/** Normalize Vercel log-drain output (a JSON array or NDJSON) into Event[]. */
export function normalizeVercelDrain(text: string, opts: VercelDrainOptions): NormalizeResult {
  const salt = opts.salt ?? "footfall-batch";
  const events: Event[] = [];
  const errors: string[] = [];

  const records: unknown[] = [];
  const trimmed = text.trim();
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr)) records.push(...arr);
    } catch {
      errors.push("input is not a valid JSON array");
    }
  } else {
    text.split("\n").forEach((line, i) => {
      const t = line.trim();
      if (!t) return;
      try {
        records.push(JSON.parse(t));
      } catch {
        errors.push(`line ${i + 1}: not valid JSON`);
      }
    });
  }

  for (const record of records) {
    const obj = asObject(record);
    if (!obj) continue;
    const event = toEvent(obj, opts.site, salt);
    if (event) events.push(event);
  }

  return { events, fieldMap: vercelDrainFieldMap, errors };
}
