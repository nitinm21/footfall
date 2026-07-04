# Footfall

[![CI](https://github.com/nitinm21/footfall/actions/workflows/ci.yml/badge.svg)](https://github.com/nitinm21/footfall/actions/workflows/ci.yml)

**Agent-experience analytics — Google Analytics + Hotjar, except the visitor is Claude Code.**

AI coding agents now make up a large and growing share of traffic to developer-facing
sites — docs, API references, changelogs. But site owners still only have human-centric
analytics, so agent behaviour is invisible: when an agent hits a JS-only page, retries,
and gives up, nothing surfaces anywhere. Footfall classifies agent traffic *behaviourally*
(user-agent headers are unreliable and some agents send none), reconstructs agent sessions,
surfaces where agents fail (404s, auth walls, empty JS shells, retry loops), and generates
fixes (`llms.txt`, markdown mirrors, redirects) from observed demand — then measures whether
the fix actually helped.

It is deliberately honest about its own limits: there is **no invented "success score."**
Only countable outcomes are reported as fact; anything heuristic is labelled `HEURISTIC`,
traffic that can't be classified confidently stays in an `unclassified` bucket, and every
classification comes with the signals ("receipts") behind it. Classifier accuracy is
measured against a labelled corpus and published in-product.

## Architecture

TypeScript monorepo (pnpm workspaces, Node 22).

```
packages/
  core/         the spine — pure functions, no I/O: schema, normalize, classify,
                sessionize, detect, recommend, aggregate
  middleware/   @footfall/next — observe-only, fail-open Next.js middleware
  report/       AnalysisResult -> self-contained static HTML report (the wedge)
  cli/          npx footfall init/check — one-command install (later phase)
apps/
  web/          dashboard + /api/ingest + onboarding + docs (Next.js)
  target/       instrumented demo docs site with known failure modes (test rig)
fixtures/       labelled ground-truth traces, sample logs, golden expected outputs
scripts/        capture, accuracy, loadtest, parity, seed
docs/           PLAN.md, design mocks, privacy one-pager
```

**Data flow.** A Vercel log drain, an uploaded JSONL export, or the live `@footfall/next`
snippet all normalize into a single `Event` schema. From there one pure pipeline
(`classify → sessionize → detect → aggregate`) drives two surfaces: a static HTML report
(no infrastructure required) and a live dashboard (events land in Tinybird; its query pipes
mirror the same aggregations, and a parity test enforces that the two never drift).

The single event contract lives in [`packages/core/src/schema.ts`](packages/core/src/schema.ts).
The full build plan is in [`docs/PLAN.md`](docs/PLAN.md).

## Development

Requires Node 22 and pnpm (via corepack).

```bash
pnpm install
pnpm -r typecheck   # tsc --noEmit across every package
pnpm lint           # biome check
pnpm -r test        # vitest
```

## Status

Early. **Phase 0 (scaffold + verification harness)** is in place: the workspace, the event
schema with a round-trip test, and CI (typecheck + lint + test on every push). Everything
else in `docs/PLAN.md` is still ahead.

## Not affiliated

Footfall is an independent, open-source project. It is **not** affiliated with, endorsed by,
or connected to Vercel, Cloudflare, Anthropic, OpenAI, Mintlify, or any other hosting
provider or agent vendor referenced in this repository. Product and company names are used
only to describe observed traffic.

## License

MIT
