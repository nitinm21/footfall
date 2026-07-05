# Footfall — what it collects, and what it doesn't

Footfall is **observe-only** agent-experience analytics. It watches request metadata to classify
the AI agents in your traffic and surface where they fail. It is designed to be a zero-trust ask:
nothing it does can affect your site or your visitors' privacy.

## What it collects (per request)

- Method, path (**query string dropped** — only a `has_query` boolean is kept)
- Status, response bytes, response time (when the source can provide them)
- User-Agent, `Accept`, `Sec-Fetch-*`, and referer **host** (not the full referer)
- Whether the request was conditional (`If-None-Match` / `If-Modified-Since`)
- A **salted hash of the IP** (salt rotates daily) — for session stitching only
- Whether the request was for a static asset
- For self-declared crawlers: whether the IP verified against the operator's published ranges

## What it never collects

- **No cookies.**
- **No request or response bodies.**
- **No raw IP addresses** — only a daily-rotating salted hash; the raw IP never leaves the edge.
- **No query strings**, so no tokens or PII smuggled in URLs.
- **No cross-site tracking, no ad identifiers, no fingerprinting beyond the fields above.**

## Fail-open by design

The middleware **never blocks, delays, redirects, or modifies** a response. Capture happens in
`waitUntil` after the response is sent, with a hard 500 ms timeout and all failures swallowed. If
Footfall's ingest is down or slow, your site is completely unaffected (proven under load in Phase 4).

## Your controls

- **Kill switch:** set `FOOTFALL_DISABLED=1` to stop all emission instantly — no redeploy of logic.
- **Caps:** per-site daily caps at both the middleware and the ingest endpoint; above the cap,
  events are sampled and the dropped count is shown — never a silent truncation, never a surprise bill.
- **Uninstall:** the whole install is one `git diff` — revert it.

## Install

```bash
npx footfall init <your-token>   # wraps middleware + wires the 5xx beacon, reviewable as one diff
# set FOOTFALL_TOKEN=<your-token> on your host, deploy, then:
npx footfall check <your-token>  # confirms the event round-trip end-to-end
```

Independent open-source project; not affiliated with any hosting provider or agent vendor.
