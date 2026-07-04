# fixtures

Ground-truth data the whole product is tested against.

```
traces/   labelled agent-session traces (JSONL) + a meta.json sidecar per label.
          One directory per label.
logs/     raw sample log files per supported source format (e.g. Vercel drain),
          scrubbed. (Empty until a real log source is available — see below.)
golden/   expected outputs for golden tests + accuracy-baseline.json. Phase 2+.
```

Every JSONL row is a schema-valid `Event` (`@footfall/core`). Every `traces/<label>/`
carries a `meta.json` sidecar (tool, version, task, date, capture mechanism). All of
this is enforced by `pnpm fixtures:validate` (`scripts/fixtures-validate.ts`).

## How the corpus is captured

The rig and proxy live in the repo, so the corpus is fully reproducible and can grow
as new agent tools ship.

1. **The rig** — `apps/target`, a small Next.js docs site with failure modes baked in:
   a client-only "empty shell" page (`/docs/interactive`), no `/llms.txt` (404), a moved
   page (`/docs/old-intro`, 404), an auth wall (`/docs/private`, 403), and normal docs.
2. **The recording proxy** — `scripts/capture.ts` sits in front of the rig and records
   the full request **and** response (status, bytes, content-type, timing) of every
   request as `Event` JSONL. (A proxy, not Next middleware, because middleware can't see
   the response.)
3. **Clients** — `scripts/crawl.ts` (naive crawler), `scripts/browse.ts` (real Chromium),
   and the agent CLIs, each driven at the proxy URL.

### Rerun / grow the corpus

```bash
# 1. build + start the rig (separate terminal)
pnpm --filter @footfall/target build
pnpm --filter @footfall/target start          # http://localhost:3000

# 2. capture a session (proxy up -> client -> proxy down), one run file each
scripts/capture-session.sh fixtures/traces/crawler/run-04.jsonl \
  ./node_modules/.bin/tsx scripts/crawl.ts http://localhost:4000

scripts/capture-session.sh fixtures/traces/human-browser/run-04.jsonl \
  ./node_modules/.bin/tsx scripts/browse.ts http://localhost:4000

scripts/capture-session.sh fixtures/traces/claude-code/run-04.jsonl \
  claude -p "Use curl to read the Acme SDK docs at http://localhost:4000 and summarize it." \
    --dangerously-skip-permissions --allowedTools Bash

scripts/capture-session.sh fixtures/traces/cursor/run-04.jsonl \
  cursor-agent -p "Use curl to read the Acme SDK docs at http://localhost:4000 and summarize it." -f

# 3. validate
pnpm fixtures:validate
```

## Label taxonomy

| Label | Family | Captured? | Signature |
|---|---|---|---|
| `claude-code` | coding agent | ✅ 3 sessions | goal-directed pages, ~0 assets, curl UA (local) |
| `cursor` | coding agent | ✅ 3 sessions | goal-directed, ~0 assets, curl UA (local) |
| `crawler` | crawler/bot | ✅ 3 sessions | breadth-first, 0 assets, bot UA, many 404s |
| `human-browser` | browser | ✅ 3 sessions | ~58% assets, real Chromium UA + sec-fetch |
| `codex` | coding agent | ⏳ deferred to Phase 4 | **no UA header** — see note |

### Note on `codex` and per-agent-family UA signatures

Locally, every coding agent shells out to `curl` to reach `localhost` (their native
fetchers are server-side and can't reach a local address), so a local capture records
`curl`'s UA, not the agent's. The **behavioural** ground truth (goal-directed, near-zero
asset ratio, dead-end probing) is captured well by `claude-code` and `cursor`.

Codex's *distinguishing* trait is that it sends **no UA header at all** — but that only
appears when it fetches a **public** site with its native client. So codex, and the true
per-family UA fingerprints generally, are a **Phase 4** capture (from the deployed
middleware), not a local Phase-1 capture. (Codex also could not be driven locally here:
its shell-exec of network requests hangs even with the sandbox disabled.)

This is why `MIN_LABELS` in the validator is 4 (the local behavioural families), not 5 —
a flagged Phase-1 deviation.

## Real-world logs (`logs/`)

Vercel log drains require a paid plan; the CLI-authed account had no projects in scope,
so no real logs were obtainable at Phase 1. Real own-site data arrives with Phase 4's
deployed middleware. Any scrubbed logs obtained later go in `logs/`.
