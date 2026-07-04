// normalize/ — Phase 2.
// Source-specific parsers that turn raw input into Event[]:
//   vercel-drain.ts (Vercel log-drain JSON), jsonl.ts (validated passthrough).
// Each normalizer also exports its field map (which Event fields it can populate),
// which feeds the coverage matrix.
export {};
