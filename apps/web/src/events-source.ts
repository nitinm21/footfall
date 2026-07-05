// The dashboard's event source (approach B: raw events out of storage, classification in core).
// Fixture sites read a checked-in JSONL (the seeded demo); live sites read the Tinybird pipes,
// then apply corrections + the rendered-implies-200 convention via core.resolveStatuses.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  ALL_FIELDS,
  type Correction,
  type Event,
  EventSchema,
  type FieldMap,
  normalizeJsonl,
  resolveStatuses,
} from "@footfall/core";
import type { Site } from "../db/schema";

export interface SourcedEvents {
  events: Event[];
  fieldMap: FieldMap;
}

/**
 * Field map for the always-on live snippet on Vercel: every field except response bytes
 * (Next middleware can't observe it), so the byte-based empty-shell heuristic greys out —
 * exactly the Phase 4 coverage design.
 */
export const liveFieldMap: FieldMap = {
  source: "live snippet",
  realtime: true,
  fields: ALL_FIELDS.filter((f) => f !== "resp_bytes"),
};

function fixtureRoot(): string {
  return process.env.FOOTFALL_FIXTURE_ROOT ?? process.cwd();
}

/** Load one site's events within [since, until). Dispatches on the site's source. */
export async function getSiteEvents(
  site: Pick<Site, "token" | "source" | "fixture">,
  since: number,
  until: number,
): Promise<SourcedEvents> {
  if (site.source === "fixture" && site.fixture) {
    const text = await readFile(join(fixtureRoot(), site.fixture), "utf8");
    const { events, fieldMap } = normalizeJsonl(text);
    return { events: events.filter((e) => e.ts >= since && e.ts < until), fieldMap };
  }
  const events = await queryEvents(site.token, since, until);
  const corrections = await queryCorrections(since, until);
  return { events: resolveStatuses(events, corrections), fieldMap: liveFieldMap };
}

// ── Tinybird pipe access (live sites) ────────────────────────────────────────

type Row = Record<string, unknown>;

async function queryPipe(name: string, params: Record<string, string | number>): Promise<Row[]> {
  const token = process.env.TINYBIRD_TOKEN;
  if (!token) return []; // no storage configured (local dev without Tinybird) → empty, not an error
  const host = process.env.TINYBIRD_HOST ?? "https://api.tinybird.co";
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  const res = await fetch(`${host}/v0/pipes/${name}.json?${qs}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`tinybird pipe ${name}: ${res.status}`);
  const json = (await res.json()) as { data: Row[] };
  return json.data ?? [];
}

function num(v: unknown): number | null {
  return v === null || v === undefined ? null : Number(v);
}
function bool(v: unknown): boolean {
  return Number(v) === 1;
}
function str(v: unknown): string | null {
  return v === null || v === undefined ? null : String(v);
}

function rowToEvent(r: Row): Event | null {
  const candidate: Record<string, unknown> = {
    v: Number(r.v),
    ts: Number(r.ts),
    site: String(r.site),
    method: String(r.method),
    path: String(r.path),
    has_query: bool(r.has_query),
    status: num(r.status),
    resp_bytes: num(r.resp_bytes),
    content_type: str(r.content_type),
    duration_ms: num(r.duration_ms),
    ua: str(r.ua),
    accept: str(r.accept),
    sec_fetch_mode: str(r.sec_fetch_mode),
    referer_host: str(r.referer_host),
    conditional: bool(r.conditional),
    ip_hash: String(r.ip_hash),
    asset: bool(r.asset),
  };
  if (r.request_id) candidate.request_id = String(r.request_id);
  if (r.bot_verified) candidate.bot_verified = r.bot_verified;
  const parsed = EventSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

async function queryEvents(site: string, since: number, until: number): Promise<Event[]> {
  const rows = await queryPipe("events_by_site", { site, since, until });
  return rows.map(rowToEvent).filter((e): e is Event => e !== null);
}

async function queryCorrections(since: number, until: number): Promise<Correction[]> {
  const rows = await queryPipe("corrections_by_site", { since, until });
  return rows.map((r) => ({
    request_id: String(r.request_id),
    status: Number(r.status),
    path: str(r.path),
    ts: Number(r.ts),
  }));
}

/** Timestamp of the most recent event — powers the "last event Ns ago" live indicator. */
export async function latestEventTs(
  site: Pick<Site, "token" | "source" | "fixture">,
  now: number,
): Promise<number | null> {
  if (site.source === "fixture" && site.fixture) {
    const { events } = await getSiteEvents(site, 0, Number.MAX_SAFE_INTEGER);
    return events.length ? Math.max(...events.map((e) => e.ts)) : null;
  }
  const rows = await queryPipe("events_by_site", {
    site: site.token,
    since: now - 2 * 86_400_000,
    until: now,
  });
  const ts = rows.map((r) => Number(r.ts));
  return ts.length ? Math.max(...ts) : null;
}
