# Footfall support runbook

For diagnosing installs and reading a site's data. Pairs with the public `/docs` page and
`docs/privacy.md` (the recruit-facing one-pager).

## Install failures (`npx footfall init <token>`)

| Symptom | Cause | Fix |
|---|---|---|
| `✗ Token not recognized` | Wrong token, or the site isn't added yet | Add the site in the dashboard (**+ Add site**), copy the exact token |
| `✗ This doesn't look like a Next.js project` | Run from the wrong dir, or no `next` dep | Re-run with `--cwd <project>`; confirm `next` is in `package.json` |
| `Manual step for middleware.ts (left untouched)` | Existing middleware shape we won't guess at | Follow the printed instructions: `export default withFootfall(yourMiddleware)` |
| Wrapped, but no events arrive | `FOOTFALL_TOKEN` not set on the host | Set `FOOTFALL_TOKEN=<token>` on Vercel (or `vercel env add`), redeploy |
| Pages Router site: statuses all null | No app-router instrumentation hook | Expected — the coverage matrix greys byte/empty-shell modules; traffic + families still work |
| `footfall check` times out | Token/ingest env missing, or not deployed yet | Confirm the deploy is live and `FOOTFALL_TOKEN` + `FOOTFALL_INGEST_URL` are set |

Confirm a live install end-to-end: `npx footfall check <token>` (fetches the site and confirms the
event round-trip with timing).

## Reading drop counters (sampling)

- The dashboard shows a **sampling notice** when the ingest cap was hit that period.
- Source of truth: the `site_usage` table (`received`, `dropped` per UTC day). `pnpm quality`
  surfaces per-site `dropped` and flags `sampled (cap hit)`.
- The cap is a **soft** cap (env `FOOTFALL_INGEST_DAILY_CAP`, 0 = uncapped). Above it, the batch's
  tail is dropped and counted — never a silent truncation. Raise the cap or reduce volume.

## Safely uninstalling

1. **Instant stop, no redeploy of logic:** set `FOOTFALL_DISABLED=1` on the host. Emission halts.
2. **Full removal:** the entire install is one `git diff` — revert the `middleware.ts` wrap +
   `instrumentation.ts` beacon + `.env.local` line, and remove `@footfall/next`. No other traces
   (no cookies, no bodies, no client code).

## Wedge intake (recruits who won't install anything)

No infra required on their side — just a log export:

1. Ask for a **Vercel log-drain export** or a **JSONL** capture.
2. Generate the static report:
   ```bash
   pnpm footfall report --format vercel --in their-export.json --out report.html --site-name "Their Site"
   # or: --format jsonl for a native capture
   ```
3. Send them `report.html` (self-contained, honest field-coverage + classifier accuracy in the
   footer). Modules grey out for signals their export lacks — never guessed.

This is the parallel recruiting track: a wedge report needs zero trust and zero install, and it's
how a prospect becomes a snippet install later.

## Data quality before citing a site

Run `pnpm quality [token]` and check:
- **≥2 weeks** of data (`span`), no large capture **gaps**
- **unclassified %** low (high → investigate the corpus, may need new traces)
- **dropped = 0** (or the cap is intentional)

Only cite sites that pass. Record findings in `docs/findings/`.
