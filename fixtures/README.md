# fixtures

Ground-truth data the whole product is tested against.

```
traces/   labelled agent-session traces (JSONL) + a meta.json sidecar per run.
          One directory per label. Populated in Phase 1.
logs/     raw sample log files per supported source format (e.g. Vercel drain),
          scrubbed. Populated in Phase 1+.
golden/   expected outputs for golden tests + accuracy-baseline.json. Phase 2+.
```

## Label taxonomy (Phase 1)

Each `traces/<label>/` holds ≥3 sessions. Planned labels:

| Label | What it is | Expected signature |
|---|---|---|
| `claude-code` | Claude Code reading the docs rig | ~0 assets, UA present |
| `cursor` | Cursor doing the same tasks | ~0 assets, UA present |
| `codex` | Codex CLI doing the same tasks | ~0 assets, **no UA header** |
| `human-browser` | Nitin browsing normally in Chrome | many assets, browser headers |
| `crawler` | naive script/curl crawl of every URL | breadth-first, no JS |

Every JSONL row must validate against the core `Event` schema; every trace directory
must carry a `meta.json` sidecar (tool, version, task given, date). Enforced by
`scripts/fixtures-validate.ts` (Phase 1).
