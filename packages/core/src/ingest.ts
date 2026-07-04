// The ingest wire contract — shared by @footfall/next (sender) and /api/ingest (receiver).

import { z } from "zod";
import { type Event, EventSchema } from "./schema";

/** A server-side status beacon (404 from not-found.tsx, 5xx from onRequestError). */
export const CorrectionSchema = z.object({
  request_id: z.string(),
  status: z.number().int(),
  path: z.string().nullable(),
  ts: z.number().int().nonnegative(),
});
export type Correction = z.infer<typeof CorrectionSchema>;

/** One POST body to /api/ingest: request events and/or status corrections. */
export const IngestPayloadSchema = z.object({
  site: z.string().min(1),
  events: z.array(EventSchema).optional(),
  corrections: z.array(CorrectionSchema).optional(),
  /** Count of events the sender sampled away since its last emit (never silent). */
  dropped: z.number().int().nonnegative().optional(),
});
export type IngestPayload = z.infer<typeof IngestPayloadSchema>;

/**
 * Resolve middleware-source statuses: apply corrections by request_id, and fall back
 * to the "rendered page implies 200" convention. Assets and API routes keep null
 * status (the coverage matrix handles them) — we never guess a status for those.
 */
export function resolveStatuses(events: Event[], corrections: Correction[]): Event[] {
  const byId = new Map(corrections.map((c) => [c.request_id, c]));
  return events.map((e) => {
    const correction = e.request_id ? byId.get(e.request_id) : undefined;
    if (correction) return { ...e, status: correction.status };
    if (e.status === null && e.method === "GET" && !e.asset && !e.path.startsWith("/api")) {
      return { ...e, status: 200 };
    }
    return e;
  });
}
