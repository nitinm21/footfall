import { z } from "zod";

/**
 * Event schema version. Bump only on a breaking change to the shape below;
 * every event carries this in its `v` field so mixed-version streams stay readable.
 */
export const EVENT_VERSION = 1 as const;

/**
 * The single event contract.
 *
 * Both the log parsers (`normalize/`) and the live middleware (`@footfall/next`)
 * produce this shape, and everything downstream (classify → sessionize → detect →
 * aggregate) consumes only this. Nullable fields are the ones a given source may
 * not be able to provide; they power the field-coverage matrix — a report module
 * whose required fields are null for the source greys out instead of guessing.
 */
export const EventSchema = z.object({
  /** Event schema version. Always {@link EVENT_VERSION} for v1 events. */
  v: z.literal(EVENT_VERSION),
  /** Edge/log timestamp, epoch milliseconds. */
  ts: z.number().int().nonnegative(),
  /** Site token this event belongs to (multi-tenant key). */
  site: z.string().min(1),
  /** HTTP method. */
  method: z.string().min(1),
  /** Request path with the query string dropped (see `has_query`). */
  path: z.string(),
  /** Whether the original request carried a query string (the string itself is dropped). */
  has_query: z.boolean(),
  /**
   * HTTP status. Nullable: some sources can't observe it (e.g. Next middleware
   * runs before the response; assets/API routes without status beacons), in which
   * case the coverage matrix handles the gap rather than the pipeline guessing.
   */
  status: z.number().int().nullable(),
  /** Response size in bytes; null when the source can't provide it. */
  resp_bytes: z.number().int().nonnegative().nullable(),
  /** Response Content-Type header; null when unavailable. */
  content_type: z.string().nullable(),
  /** Server-observed request duration in ms; null when unavailable. */
  duration_ms: z.number().int().nonnegative().nullable(),
  /** User-Agent, verbatim. Null/absent is itself a classification signal. */
  ua: z.string().nullable(),
  /** Accept header — powers the markdown-preference feature. */
  accept: z.string().nullable(),
  /** Sec-Fetch-Mode header — a browser fingerprint feature. */
  sec_fetch_mode: z.string().nullable(),
  /** Referer host only (path/query stripped). */
  referer_host: z.string().nullable(),
  /** If-None-Match / If-Modified-Since present on the request. */
  conditional: z.boolean(),
  /** Salted IP hash (salt rotates daily); the raw IP is never stored. */
  ip_hash: z.string().min(1),
  /** Whether this is a static asset (css/js/img/font) — kept, not dropped: asset ratio is a top classifier feature. */
  asset: z.boolean(),
  /**
   * Correlation id stamped by the live middleware (`x-footfall-id`) so a later
   * server-side status beacon can correct the (unknown-at-middleware-time) status.
   * Optional: only the live source populates it; log sources omit it.
   */
  request_id: z.string().optional(),
});

/** A single normalized request event — the unit every pipeline stage operates on. */
export type Event = z.infer<typeof EventSchema>;

/** Parse-and-validate an unknown value into an {@link Event}; throws on invalid input. */
export function parseEvent(input: unknown): Event {
  return EventSchema.parse(input);
}
