import { type Event, EventSchema } from "../schema";
import { ALL_FIELDS, type FieldMap } from "./field-map";

/** Native format: one Event JSON object per line (what the capture proxy writes). */
export const jsonlFieldMap: FieldMap = {
  source: "jsonl",
  realtime: false,
  fields: ALL_FIELDS,
};

export interface NormalizeResult {
  events: Event[];
  fieldMap: FieldMap;
  errors: string[];
}

/** Validate JSONL text into Event[]; malformed lines are collected, not thrown. */
export function normalizeJsonl(text: string): NormalizeResult {
  const events: Event[] = [];
  const errors: string[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    try {
      const parsed = EventSchema.safeParse(JSON.parse(line));
      if (parsed.success) {
        events.push(parsed.data);
      } else {
        errors.push(`line ${i + 1}: ${parsed.error.issues[0]?.message ?? "invalid event"}`);
      }
    } catch {
      errors.push(`line ${i + 1}: not valid JSON`);
    }
  }
  return { events, fieldMap: jsonlFieldMap, errors };
}
