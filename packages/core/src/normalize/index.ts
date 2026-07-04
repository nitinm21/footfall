// normalize/ — source-specific parsers that turn raw input into Event[].
// Each normalizer exports its field map (which Event fields it can populate),
// which feeds the coverage matrix.

export { ALL_FIELDS, type EventField, type FieldMap, hasField } from "./field-map";
export { jsonlFieldMap, type NormalizeResult, normalizeJsonl } from "./jsonl";
export {
  normalizeVercelDrain,
  type VercelDrainOptions,
  vercelDrainFieldMap,
} from "./vercel-drain";
