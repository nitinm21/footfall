# scripts

Repo-level scripts, added as their phase arrives:

| Script | Phase | Purpose |
|---|---|---|
| `capture.ts` | 1 | Recording reverse proxy in front of `apps/target` → labelled JSONL. |
| `fixtures-validate.ts` | 1 | Every JSONL row schema-valid; sidecars present; taxonomy documented. |
| `accuracy.ts` | 2 | Run the classifier over `fixtures/traces`; print precision/recall + unclassified rate. |
| `parity.ts` | 4 | Assert core aggregations (TS) ≡ Tinybird pipes (SQL) on a fixture window. |
| `loadtest.ts` | 4 | autocannon fail-open proof (baseline / healthy / down / slow ingest). |
| `seed.ts` | 5 | Load fixture data into a demo site for the dashboard + e2e. |
| `quality.ts` | 7 | Per-site data-quality checks for production deployments. |
| `post-charts.ts` | 8 | Regenerate every chart/number in the launch post from the real dataset. |
