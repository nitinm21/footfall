# The State of Agent Traffic on N Real Sites

> **STATUS: DRAFT SCAFFOLD — awaiting the real dataset (Phase 7).** Every `[[bracketed]]` number
> below is a placeholder filled from `pnpm post-charts` once ≥5 sites have ≥2 weeks of clean data
> (`pnpm quality` passing). Do not publish numbers that aren't regenerated from the pipeline, and
> don't name a site whose owner hasn't consented (`docs/findings/`). The methodology + reproducibility
> sections are data-independent and essentially ready.

## Hook
Across **[[N]] real sites** over **[[weeks]] weeks**, **[[agent_share]]% of requests came from AI
agents** — and **[[dead_end_pct]]% of agent sessions hit a dead end** (a 404, an auth wall, an empty
JS shell, or a retry loop). Site owners can't see any of this with human-centric analytics.

## Who's visiting
- Traffic split: agents [[agent_share]]%, humans [[human_share]]%, crawlers [[crawler_share]]%.
- Agent families: [[family_mix]] (behavioural estimates flagged `HEURISTIC`; some agents send no
  user-agent at all).
- Impersonation: **[[spoofed]] requests claimed a verifiable crawler (e.g. Googlebot) from an
  unlisted IP** and were caught by IP verification — a live finding, not a hypothetical.

## Where agents fail
- Dead ends (404/410): [[dead_end]] · Auth walls (401/403): [[auth_wall]] · Retry loops: [[retry_loop]] ·
  Empty shells: [[empty_shell]] `HEURISTIC`.
- **The most-requested file that doesn't exist: [[top_404_path]]** ([[top_404_count]] requests,
  [[top_404_agent]] from agents). The single highest-leverage fix for most sites is publishing it.

## One fix that worked (before/after)
On **[[fix_site]]**, shipping **[[fix_path]]** on [[fix_date]] took agent failures on that path from
**[[before]] → [[after]]** in the [[window]]-day windows around the change, with **[[success_after]]**
successful fetches since. (Fix-impact card, regenerated from the pipeline.)

## Methodology (published, honest)
- **No invented "success score."** Only countable outcomes are reported as fact; anything heuristic
  is labelled `HEURISTIC`; traffic that can't be classified confidently stays `unclassified` and is
  never force-assigned. Every classification carries its signals ("receipts").
- **Classifier accuracy** (labelled corpus): overall [[accuracy]]%, Tier-1 UA precision [[tier1]]%,
  unclassified rate [[unclassified]]% — all from `scripts/accuracy.ts`, gated in CI.
- **Caveats:** request-share ≠ user-share; sample skews toward developer-facing sites; behavioural
  classification is imperfect; empty-shell + behavioural-agent numbers are heuristic.

## Reproducibility
Every number above is regenerated from Footfall's own pipeline (`pnpm post-charts [--in <export>]`) —
no hand-typed stats. The public demo dashboard (`/demo`) shows the same analysis on sample data.

---

## Distribution checklist (Nitin's track — not part of the build)
- [ ] Each cited site owner has approved their mention (or the number is cited anonymized per `docs/findings/`).
- [ ] Regenerate all numbers with `pnpm post-charts` against the final dataset; paste in; re-read cold.
- [ ] Would a skeptical Cloudflare/Vercel engineer accept every claim + caveat? If not, cut it.
- [ ] Publish the public demo (`/demo`) link alongside the post.
- [ ] Outreach list: the people/teams whose stats it cites; the platforms it belongs on (HN, the
      agent-vendor + hosting-provider communities, relevant newsletters).
- [ ] Link the repo (`npx footfall init`) and the `footfall` npm package.
