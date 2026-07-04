# Design contract — dashboard mocks

The approved dashboard mock is the visual/data contract for the report (Phase 3) and
the dashboard (Phase 5). It is a Claude artifact with two relevant versions:

- **`v2-dashboard-decluttered`** (current) — the approved dashboard mock (both tabs:
  Log Report + Live Dashboard). → save here as `footfall-dashboards.v2-dashboard-decluttered.html`
- **`v1-two-tab-spec`** — the earlier version carrying per-module data-contract
  annotations (fields consumed + computation per module). → save here as
  `footfall-dashboards.v1-two-tab-spec.html`

Artifact: https://claude.ai/code/artifact/629ba2bc-f73c-4f88-bfc3-8d5ed567b260
(use the version picker to switch between the two versions).

## Status

- **`v2-dashboard-decluttered`** — ✅ landed. Exported losslessly from the artifact's
  current version as `footfall-dashboards.v2-dashboard-decluttered.html` (standalone,
  self-contained HTML — opens directly in a browser; the claude.ai iframe runtime is
  stripped since it isn't part of the design).
- **`v1-two-tab-spec`** — ⚠️ still needs manual export. The fetch path can only target
  the artifact's *current* version, so the earlier v1 (with per-module data-contract
  annotations) can't be pulled automatically. Please open the artifact, switch to
  `v1-two-tab-spec` in the version picker, download it, and drop it here as
  `footfall-dashboards.v1-two-tab-spec.html`.

These files aren't required by any Phase 0 automated gate, but they are the design
contract Phases 3 and 5 build against, so v1 should also land before Phase 3.
