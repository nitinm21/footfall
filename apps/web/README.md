# @footfall/web

Dashboard + `/api/ingest` + onboarding + public docs (Next.js on Vercel).

## Deploy (Vercel)

Deployed as a Vercel project in a pnpm monorepo:

- **Project:** `footfall` (scope `nitinjkv-3819s-projects`), **Root Directory** `apps/web`
  (set via the project settings API — uploads the whole repo, builds in `apps/web` so
  the `@footfall/core` workspace dependency resolves).
- **Production:** https://footfall-phi.vercel.app
- **Env vars (production):** `TINYBIRD_TOKEN` (scoped *append* token, not admin),
  `TINYBIRD_HOST`, `FOOTFALL_IP_SALT`.
- **Deploy:** `vercel deploy --prod` from the repo root.

`/api/ingest` (Node runtime) validates the batch (`core` `IngestPayloadSchema`), checks
the site token, and forwards to Tinybird when `TINYBIRD_TOKEN` is set (else a local file
sink for dev). Verified live: a POST round-trips into the Tinybird `events` datasource in
seconds.

## Status

- Phase 4 — `/api/ingest` live.
- Phase 5 — the Live Dashboard (design contract = the mock), Auth.js, Neon metadata.
- Phase 6 — self-serve onboarding, install docs / privacy page, digests.
