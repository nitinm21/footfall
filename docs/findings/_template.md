# Finding — <site slug>

- **site:** <domain or anonymized label>
- **owner_contact:** <name / handle>
- **install:** snippet | wedge-report
- **window:** <YYYY-MM-DD> → <YYYY-MM-DD> (<N> weeks)
- **consent:**
  - cite_publicly: no        # may the site be named in the launch post?
  - anonymized_ok: no        # may the numbers be cited without naming the site?
  - notes: <what the owner agreed to, verbatim>

## Numbers (reproducible)

- agent share of traffic: <X>% ( `pnpm quality` / dashboard )
- top agent families: <…>
- failed agent requests: <N> (dead_end <n> · auth_wall <n> · retry_loop <n> · empty_shell <n> HEURISTIC)
- most-requested path that 404s: <path> (<n> agent hits)
- unclassified rate: <X>%   ·   capture gaps: <N> day(s)

## Fix + impact (if any)

- fix shipped: <path / change> on <date>
- before/after: <N> failures → <N> ( `pnpm quality` / fix-impact card )

## Caveats

- <sample skew, request-share ≠ user-share, heuristic flags, self-traffic excluded, …>
