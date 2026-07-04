// /api/ingest core — runtime-agnostic: token check → zod validation → pluggable sink.
// The middleware ignores the response, so we just return a correct status.

import { type IngestPayload, IngestPayloadSchema } from "@footfall/core";

export type Sink = (payload: IngestPayload) => Promise<void>;

export interface IngestResult {
  status: number;
  body: string;
}

export const MAX_EVENTS = 1000;

/**
 * Validate + authorize + persist a batch. In v1 the write token *is* the site token,
 * so we require the Authorization token to match `payload.site` (real token→site
 * mapping arrives with the metadata DB in Phase 5/6).
 */
export async function handleIngest(
  raw: unknown,
  authToken: string | null,
  sink: Sink,
  maxEvents = MAX_EVENTS,
): Promise<IngestResult> {
  if (!authToken) return { status: 401, body: "missing token" };

  const parsed = IngestPayloadSchema.safeParse(raw);
  if (!parsed.success) return { status: 400, body: "invalid payload" };
  const payload = parsed.data;

  if (payload.site !== authToken) return { status: 403, body: "token/site mismatch" };

  const count = (payload.events?.length ?? 0) + (payload.corrections?.length ?? 0);
  if (count > maxEvents) return { status: 413, body: "batch too large" };

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
