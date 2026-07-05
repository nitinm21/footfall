# Findings log

Per-site, anonymized observations as real data accumulates — the raw material for the Phase 8
launch post ("The State of Agent Traffic on N Real Sites"). One markdown file per site:
`docs/findings/<slug>.md` (use `_template.md`).

## Rules

- **Consent gates citation.** Nothing in a finding may appear in the public post unless
  `consent.cite_publicly` is `yes`. `consent.anonymized_ok` allows citing the *number* without
  naming the site. Default to not citing.
- **Countable over clever.** Prefer numbers that regenerate from the pipeline (`pnpm quality`,
  `pnpm footfall report`, the dashboard) over impressions. Every cited number must be reproducible.
- **Flag heuristics.** Empty-shell and behavioural-agent numbers carry the `HEURISTIC` caveat.
- **Only cite quality-passing sites** (≥2 weeks, low unclassified, no big gaps, no silent sampling).

## Index

| Site (slug) | Consent | Weeks of data | Headline finding |
|---|---|---|---|
| _(none yet — recruiting in progress)_ | | | |
