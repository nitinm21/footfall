import type { Event } from "../schema";

export type EventField = keyof Event;

/**
 * What a source can populate. Drives the field-coverage matrix: a report module
 * whose required fields aren't in `fields` greys out instead of guessing.
 */
export interface FieldMap {
  source: string;
  /** Whether events arrive continuously (enables alerts / fix verification). */
  realtime: boolean;
  fields: EventField[];
}

/** Every Event field — the capability of our native JSONL / live middleware. */
export const ALL_FIELDS: EventField[] = [
  "v",
  "ts",
  "site",
  "method",
  "path",
  "has_query",
  "status",
  "resp_bytes",
  "content_type",
  "duration_ms",
  "ua",
  "accept",
  "sec_fetch_mode",
  "referer_host",
  "conditional",
  "ip_hash",
  "asset",
];

export function hasField(fieldMap: FieldMap, field: EventField): boolean {
  return fieldMap.fields.includes(field);
}
