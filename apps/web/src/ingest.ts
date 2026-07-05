// /api/ingest core — runtime-agnostic: token check → zod validation → pluggable sink.
// The middleware ignores the response, so we just return a correct status.

import { type IngestPayload, IngestPayloadSchema } from "@footfall/core";

export type Sink = (payload: IngestPayload) => Promise<void>;

export interface IngestResult {
  status: number;
  body: string;
}

export const MAX_EVENTS = 1000;

export interface HandleIngestOptions {
  /** Max events+corrections per request (413 above it). */
  maxEvents?: number;
  /**
   * Per-site daily cap check: given the site and this batch's event count, returns how many to
   * accept vs drop. Injected by the route (Postgres counter); omitted in tests that don't cap.
   */
  recordUsage?: (site: string, eventCount: number) => Promise<{ accept: number; drop: number }>;
}

/**
 * Validate + authorize + (cap) + persist a batch. In v1 the write token *is* the site token,
 * so the Authorization token must match `payload.site`. Above the per-site daily cap the batch's
 * tail is sampled away and the dropped count is recorded — never a silent truncation.
 */
export async function handleIngest(
  raw: unknown,
  authToken: string | null,
  sink: Sink,
  opts: HandleIngestOptions = {},
): Promise<IngestResult> {
  const maxEvents = opts.maxEvents ?? MAX_EVENTS;
  if (!authToken) return { status: 401, body: "missing token" };

  const parsed = IngestPayloadSchema.safeParse(raw);
  if (!parsed.success) return { status: 400, body: "invalid payload" };
  let payload = parsed.data;

  if (payload.site !== authToken) return { status: 403, body: "token/site mismatch" };

  const count = (payload.events?.length ?? 0) + (payload.corrections?.length ?? 0);
  if (count > maxEvents) return { status: 413, body: "batch too large" };

  const events = payload.events ?? [];
  if (opts.recordUsage && events.length > 0) {
    const { accept, drop } = await opts.recordUsage(payload.site, events.length);
    if (drop > 0) {
      payload = {
        ...payload,
        events: events.slice(0, accept),
        dropped: (payload.dropped ?? 0) + drop,
      };
    }
  }

  try {
    await sink(payload);
  } catch {
    return { status: 502, body: "sink error" };
  }
  return { status: 202, body: "accepted" };
}

/** Append events + corrections as JSONL (local dev / dogfood). Node runtime only. */
export function fileSink(path: string): Sink {
  return async (payload) => {
    const { appendFile } = await import("node:fs/promises");
    const lines: string[] = [];
    for (const e of payload.events ?? []) lines.push(JSON.stringify({ kind: "event", ...e }));
    for (const c of payload.corrections ?? [])
      lines.push(JSON.stringify({ kind: "correction", ...c }));
    if (payload.dropped)
      lines.push(JSON.stringify({ kind: "dropped", site: payload.site, dropped: payload.dropped }));
    if (lines.length) await appendFile(path, `${lines.join("\n")}\n`);
  };
}

/** Forward to the Tinybird Events API (production). Events and corrections → separate datasources. */
export function tinybirdSink(token: string, host: string, fetchImpl: typeof fetch = fetch): Sink {
  const post = async (datasource: string, rows: unknown[]) => {
    if (rows.length === 0) return;
    const ndjson = rows.map((r) => JSON.stringify(r)).join("\n");
    const res = await fetchImpl(`${host}/v0/events?name=${datasource}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/x-ndjson" },
      body: ndjson,
    });
    if (!res.ok) throw new Error(`tinybird ${datasource} ${res.status}`);
  };
  return async (payload) => {
    await post("events", payload.events ?? []);
    await post("corrections", payload.corrections ?? []);
  };
}

/** Collect in memory (tests). */
export function memorySink(): { sink: Sink; received: IngestPayload[] } {
  const received: IngestPayload[] = [];
  return { sink: async (p) => void received.push(p), received };
}

/** Choose a sink from env (used by the route). */
export function sinkFromEnv(env: Record<string, string | undefined> = process.env): Sink {
  if (env.TINYBIRD_TOKEN) {
    return tinybirdSink(env.TINYBIRD_TOKEN, env.TINYBIRD_HOST ?? "https://api.tinybird.co");
  }
  if (env.FOOTFALL_LOCAL_SINK) return fileSink(env.FOOTFALL_LOCAL_SINK);
  return async () => {}; // accept-and-drop (no sink configured)
}
