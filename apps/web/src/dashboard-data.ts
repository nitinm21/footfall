// Builds everything a dashboard render needs from a site's raw events (approach B): the current
// window's AnalysisResult, KPI deltas vs the prior window, the failure feed with fix status, and
// the fix-impact before/after. All numbers come from core's analyze() so the dashboard can never
// drift from the report or the golden aggregates.

import { type AnalysisResult, analyze, type Event, type FieldMap } from "@footfall/core";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { fixes as fixesTable, type Site } from "../db/schema";
import { getSiteEvents } from "./events-source";
import { droppedSince } from "./usage";

const DAY = 86_400_000;
export const WINDOW_DAYS = 14;
export const FIX_IMPACT_DAYS = 7;

export interface Kpis {
  agentRequests: number;
  agentSharePct: number;
  agentSessions: number;
  failedAgentRequests: number;
}

export interface FailureRow {
  type: string;
  path: string;
  agentHits: number;
  totalHits: number;
  heuristic: boolean;
  /** first-half vs second-half agent-failure counts within the window (the trend arrow). */
  trend: "up" | "down" | "flat" | "resolved";
  status: "open" | "fix_live";
  fixedAt: number | null;
}

export interface FixImpact {
  path: string;
  type: string;
  deployedAt: number;
  windowDays: number;
  beforeFailures: number;
  afterFailures: number;
  successAfter: number;
}

export interface DashboardData {
  site: Pick<Site, "token" | "name" | "source">;
  from: number;
  to: number;
  result: AnalysisResult;
  kpis: Kpis;
  prev: Kpis | null;
  failureFeed: FailureRow[];
  fixImpact: FixImpact | null;
  lastEventTs: number | null;
  isEmpty: boolean;
  /** Events sampled away by the ingest cap in this window (drives the sampling notice). */
  sampledDropped: number;
}

function kpisOf(r: AnalysisResult): Kpis {
  const agent = r.trafficSplit.find((x) => x.class === "agent");
  const ft = r.failureTotals;
  return {
    agentRequests: agent?.requests ?? 0,
    agentSharePct: r.agentSharePct,
    agentSessions: agent?.sessions ?? 0,
    failedAgentRequests:
      ft.dead_end + ft.auth_wall + ft.retry_loop + (ft.empty_shell_available ? ft.empty_shell : 0),
  };
}

/** Count failing responses (4xx/5xx) at a path within [since, until). */
function countFailing(events: Event[], path: string, since: number, until: number): number {
  let n = 0;
  for (const e of events) {
    if (e.path !== path) continue;
    if (e.ts < since || e.ts >= until) continue;
    if (e.status !== null && e.status >= 400) n += 1;
  }
  return n;
}

function countStatus2xx(events: Event[], path: string, since: number, until: number): number {
  let n = 0;
  for (const e of events) {
    if (e.path !== path) continue;
    if (e.ts < since || e.ts >= until) continue;
    if (e.status !== null && e.status >= 200 && e.status < 300) n += 1;
  }
  return n;
}

/** Automatic 404→200 detection: failures present early in the window, gone by the end. */
function trendOf(events: Event[], path: string, from: number, to: number): FailureRow["trend"] {
  const mid = from + (to - from) / 2;
  const before = countFailing(events, path, from, mid);
  const after = countFailing(events, path, mid, to);
  if (before > 0 && after === 0) return "resolved";
  if (after > before) return "up";
  if (after < before) return "down";
  return "flat";
}

/** A marked fix, as assembleDashboard needs it (DB row or a synthetic demo fix). */
export type FixLike = { path: string; type: string; markedDeployedAt: Date };

/** Build the fix-impact card for the marked fix with the largest before-window failure count. */
function computeFixImpact(all: Event[], fixes: FixLike[]): FixImpact | null {
  let best: FixImpact | null = null;
  for (const fix of fixes) {
    const deployedAt = fix.markedDeployedAt.getTime();
    const span = FIX_IMPACT_DAYS * DAY;
    const beforeFailures = countFailing(all, fix.path, deployedAt - span, deployedAt);
    const afterFailures = countFailing(all, fix.path, deployedAt, deployedAt + span);
    const successAfter = countStatus2xx(all, fix.path, deployedAt, deployedAt + span);
    const impact: FixImpact = {
      path: fix.path,
      type: fix.type,
      deployedAt,
      windowDays: FIX_IMPACT_DAYS,
      beforeFailures,
      afterFailures,
      successAfter,
    };
    if (!best || impact.beforeFailures > best.beforeFailures) best = impact;
  }
  return best;
}

/**
 * Pure(ish) dashboard assembly from already-loaded events + fixes — no DB, no I/O. Shared by the
 * authenticated dashboard (buildDashboard) and the public demo (buildDemoDashboard). `now` is
 * injected for determinism; fixture sources anchor their window to the data's own last timestamp.
 */
export function assembleDashboard(input: {
  all: Event[];
  fieldMap: FieldMap;
  fixes: FixLike[];
  now: number;
  site: Pick<Site, "token" | "name" | "source">;
  sampledDropped?: number;
}): DashboardData {
  const { all, fieldMap, fixes, now, site } = input;
  const isFixture = site.source === "fixture";
  const to = isFixture ? (all.length ? Math.max(...all.map((e) => e.ts)) + 1 : now) : now;

  const from = to - WINDOW_DAYS * DAY;
  const prevFrom = from - WINDOW_DAYS * DAY;
  const cur = all.filter((e) => e.ts >= from && e.ts < to);
  const prevEvents = all.filter((e) => e.ts >= prevFrom && e.ts < from);

  const opts = { site: site.token, siteName: site.name };
  const result = analyze(cur, fieldMap, opts);
  const prev = prevEvents.length ? kpisOf(analyze(prevEvents, fieldMap, opts)) : null;

  const fixByPath = new Map(fixes.map((f) => [f.path, f]));
  const failureFeed: FailureRow[] = result.failures.map((f) => {
    const fix = fixByPath.get(f.path);
    return {
      type: f.type,
      path: f.path,
      agentHits: f.agentHits,
      totalHits: f.totalHits,
      heuristic: f.heuristic,
      trend: trendOf(cur, f.path, from, to),
      status: fix ? "fix_live" : "open",
      fixedAt: fix ? fix.markedDeployedAt.getTime() : null,
    };
  });

  return {
    site: { token: site.token, name: site.name, source: site.source },
    from,
    to,
    result,
    kpis: kpisOf(result),
    prev,
    failureFeed,
    fixImpact: computeFixImpact(all, fixes),
    lastEventTs: all.length ? Math.max(...all.map((e) => e.ts)) : null,
    isEmpty: result.meta.totalRequests === 0,
    sampledDropped: input.sampledDropped ?? 0,
  };
}

/**
 * Load a site's events (fixture JSONL or Tinybird) + its marked fixes from the DB, then assemble.
 * `now` is injected (not read from the clock) so tests are deterministic.
 */
export async function buildDashboard(site: Site, now: number): Promise<DashboardData> {
  const isFixture = site.source === "fixture";
  // Enough history to cover the current window, the prior window (deltas), and the fix-impact span.
  const { events: all, fieldMap } = isFixture
    ? await getSiteEvents(site, 0, Number.MAX_SAFE_INTEGER)
    : await getSiteEvents(site, now - 2 * WINDOW_DAYS * DAY, now);

  const fixes = await db.select().from(fixesTable).where(eq(fixesTable.siteId, site.id));
  const from =
    (isFixture ? (all.length ? Math.max(...all.map((e) => e.ts)) + 1 : now) : now) -
    WINDOW_DAYS * DAY;
  const sampledDropped =
    site.source === "live"
      ? await droppedSince(site.token, new Date(from).toISOString().slice(0, 10))
      : 0;

  return assembleDashboard({ all, fieldMap, fixes, now, site, sampledDropped });
}
