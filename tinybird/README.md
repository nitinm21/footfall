# Tinybird project

Managed-ClickHouse storage + query pipes for the live dashboard. The ingest endpoint
(`apps/web/app/api/ingest`) forwards events/corrections here (Events API) when
`TINYBIRD_TOKEN` is set.

## Deploy (needs a Tinybird workspace token)

```bash
pip install tinybird-cli        # or: curl https://tinybird.co | sh
tb auth --token $TINYBIRD_TOKEN
cd tinybird && tb push          # pushes datasources + pipes
```

## Layout

```
datasources/events.datasource        raw request events (mirrors core Event)
datasources/corrections.datasource   5xx status beacons (correlated by request_id)
pipes/requests_by_day.pipe           daily request counts (classification-free)
pipes/top_paths.pipe                 top non-asset paths (classification-free)
pipes/events_by_site.pipe            raw events for a site + time window (Phase 5 dashboard)
pipes/corrections_by_site.pipe       corrections in a time window (Phase 5 dashboard)
```

Run `cd tinybird && tb push` after adding pipes to deploy `events_by_site` + `corrections_by_site`.

## Parity

`pnpm parity` compares core's TypeScript aggregations to the Tinybird pipe results on a
fixture window and fails on any difference (the Locked Decision: aggregations defined
once in `core`, mirrored by the pipes). It runs live only when `TINYBIRD_TOKEN` is set;
otherwise it prints the TS reference and skips the live comparison.

## Classification: approach B (Phase 5 decision)

The dashboard's class-based aggregations (traffic split, agent families, top pages by
agent demand) require **sessionization + behavioural classification**, which `core` does
in TypeScript. Rather than re-implement that in ClickHouse SQL, Phase 5 has the app read
**raw** events (`events_by_site` + `corrections_by_site`) and run core's `analyze()`
server-side. Report ⇄ dashboard parity is then automatic — both surfaces call the same
`core` functions — so there is nothing to keep in sync in two languages. Class-based SQL
pipes (or a precomputed materialized view) remain a possible future optimization if query
volume ever makes per-request classification too costly.
