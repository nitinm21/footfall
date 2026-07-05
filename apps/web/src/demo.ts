// Public demo dashboard model, assembled from the bundled sample dataset (no DB, no fixture-file
// read → works on Vercel). Deterministic: the dataset is fixed and fixture-sourced, so the window
// anchors to the data's own range regardless of wall-clock.

import { type Event, jsonlFieldMap } from "@footfall/core";
import demoEvents from "../../../fixtures/demo/dashboard-demo.json";
import { assembleDashboard, type DashboardData } from "./dashboard-data";

// Matches the /llms.txt fix baked into the generated dataset (shipped 2026-07-08).
const DEMO_FIX_TS = Date.UTC(2026, 6, 8);

export function buildDemoDashboard(now: number): DashboardData {
  return assembleDashboard({
    all: demoEvents as unknown as Event[],
    fieldMap: jsonlFieldMap,
    fixes: [{ path: "/llms.txt", type: "dead_end", markedDeployedAt: new Date(DEMO_FIX_TS) }],
    now,
    site: { token: "demo", name: "modelkit.dev · demo", source: "fixture" },
  });
}
