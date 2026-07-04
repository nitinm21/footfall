// @footfall/next — Phase 4.
// Wraps a site's middleware.ts: captures Event fields, batches, and fire-and-forget
// POSTs to /api/ingest via waitUntil. Invariants (each gets a test): never
// blocks/modifies/redirects, hard 500ms send timeout, per-site daily cap with
// visible drop counts, IP hashed before leaving the middleware, env-var config
// (FOOTFALL_TOKEN, FOOTFALL_DISABLED kill switch).
export {};
