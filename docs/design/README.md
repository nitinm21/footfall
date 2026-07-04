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

## ⚠️ Action required (Nitin)

These two HTML files are **not yet committed**. The verbatim artifact HTML can't be
exported losslessly by the build agent's tools (the fetch path returns Markdown, not
raw HTML, and can't target a specific artifact version). Please download **both**
versions from the artifact's version picker and drop the two `.html` files into this
directory. They aren't required by any Phase 0 automated gate, but they are the design
contract Phases 3 and 5 build against, so they should land before Phase 3.
