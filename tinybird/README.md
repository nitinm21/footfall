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
```

## Parity

`pnpm parity` compares core's TypeScript aggregations to the Tinybird pipe results on a
fixture window and fails on any difference (the Locked Decision: aggregations defined
once in `core`, mirrored by the pipes). It runs live only when `TINYBIRD_TOKEN` is set;
otherwise it prints the TS reference and skips the live comparison.

## Open item — classification pipes (flagged)

The dashboard's class-based aggregations (traffic split, agent families, top pages by
agent demand) require **sessionization + behavioural classification**, which core does
in TypeScript. Mirroring that in ClickHouse SQL — or precomputing class via a scheduled
materialized view — is substantial and is best authored against a live workspace. The
classification-free pipes above establish the deploy + parity harness; the class-based
pipes are the remaining Tinybird work for the deploy step.
