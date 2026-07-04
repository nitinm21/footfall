// aggregate/ — one function per dashboard/report module. THE definitions: the report
// renders these directly and Tinybird pipes must mirror them (Phase 4 parity).

import type { Detections } from "../detect";
import type { FieldMap } from "../normalize/field-map";
import type {
  ClassifiedSession,
  CoverageRow,
  DailyRow,
  FailureTotals,
  FamilyRow,
  TopPageRow,
  TrafficSplitRow,
  VisitorClass,
} from "../types";

const CLASSES: VisitorClass[] = ["human", "agent", "crawler", "unclassified"];

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function utcDay(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** Total request (event) count across all sessions. */
export function totalRequests(sessions: ClassifiedSession[]): number {
  return sessions.reduce((n, s) => n + s.events.length, 0);
}

/** Traffic split by visitor class (donut + "who is visiting"). */
export function trafficSplit(sessions: ClassifiedSession[]): TrafficSplitRow[] {
  const reqs = new Map<VisitorClass, number>();
  const sess = new Map<VisitorClass, number>();
  for (const s of sessions) {
    const c = s.classification.class;
    reqs.set(c, (reqs.get(c) ?? 0) + s.events.length);
    sess.set(c, (sess.get(c) ?? 0) + 1);
  }
  const total = totalRequests(sessions);
  return CLASSES.map((c) => {
    const requests = reqs.get(c) ?? 0;
    return {
      class: c,
      requests,
      sessions: sess.get(c) ?? 0,
      pct: total ? round1((requests / total) * 100) : 0,
    };
  });
}

/** Agent share of all requests, as a percentage. */
export function agentSharePct(sessions: ClassifiedSession[]): number {
  const total = totalRequests(sessions);
  if (!total) return 0;
  const agent = sessions
    .filter((s) => s.classification.class === "agent")
    .reduce((n, s) => n + s.events.length, 0);
  return round1((agent / total) * 100);
}

/** Requests per day by visitor class (daily line chart). */
export function dailyRollup(sessions: ClassifiedSession[]): DailyRow[] {
  const byDay = new Map<string, DailyRow>();
  for (const s of sessions) {
    const c = s.classification.class;
    for (const e of s.events) {
      const day = utcDay(e.ts);
      let row = byDay.get(day);
      if (!row) {
        row = { date: day, agent: 0, human: 0, crawler: 0, unclassified: 0 };
        byDay.set(day, row);
      }
      row[c] += 1;
    }
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Agent-class requests grouped by family ("Agent families" chart). */
export function familyBreakdown(sessions: ClassifiedSession[]): FamilyRow[] {
  const byFamily = new Map<
    string,
    { requests: number; sessions: number; heuristic: boolean; class: VisitorClass }
  >();
  for (const s of sessions) {
    if (s.classification.class !== "agent") continue;
    const family = s.classification.family ?? "unidentified";
    let row = byFamily.get(family);
    if (!row) {
      row = { requests: 0, sessions: 0, heuristic: false, class: "agent" };
      byFamily.set(family, row);
    }
    row.requests += s.events.length;
    row.sessions += 1;
    if (s.classification.heuristic) row.heuristic = true;
  }
  return [...byFamily.entries()]
    .map(([family, r]) => ({
      family,
      class: r.class,
      requests: r.requests,
      sessions: r.sessions,
      heuristic: r.heuristic,
    }))
    .sort((a, b) => b.requests - a.requests || a.family.localeCompare(b.family));
}

/** Top pages by agent demand: agent vs human page requests per path. */
export function topPagesByAgentDemand(sessions: ClassifiedSession[]): TopPageRow[] {
  const byPath = new Map<string, { agent: number; human: number }>();
  for (const s of sessions) {
    const c = s.classification.class;
    if (c !== "agent" && c !== "human") continue;
    for (const e of s.events) {
      if (e.asset) continue; // pages, not assets
      if (e.status !== null && e.status >= 400) continue; // real pages, not dead-ends
      let row = byPath.get(e.path);
      if (!row) {
        row = { agent: 0, human: 0 };
        byPath.set(e.path, row);
      }
      if (c === "agent") row.agent += 1;
      else row.human += 1;
    }
  }
  return [...byPath.entries()]
    .map(([path, r]) => {
      const denom = r.agent + r.human;
      return {
        path,
        agentRequests: r.agent,
        humanRequests: r.human,
        agentSharePct: denom ? round1((r.agent / denom) * 100) : 0,
      };
    })
    .sort((a, b) => b.agentRequests - a.agentRequests || a.path.localeCompare(b.path));
}

/** Headline failure counts (agent-focused), plus whether empty_shell is measurable. */
export function failureTotals(detections: Detections, fieldMap: FieldMap): FailureTotals {
  const sum = (fs: { agentHits: number }[]) => fs.reduce((n, f) => n + f.agentHits, 0);
  const sumTotal = (fs: { totalHits: number }[]) => fs.reduce((n, f) => n + f.totalHits, 0);
  return {
    dead_end: sum(detections.deadEnds),
    auth_wall: sum(detections.authWalls),
    empty_shell: sumTotal(detections.emptyShells),
    retry_loop: sum(detections.retryLoops),
    empty_shell_available: fieldMap.fields.includes("resp_bytes"),
  };
}

const COVERAGE_SPEC: {
  field: string;
  needs: (keyof import("../schema").Event)[];
  realtime?: boolean;
  unlocks: string;
}[] = [
  {
    field: "timestamp, path, status",
    needs: ["ts", "path", "status"],
    unlocks: "traffic, 404s, retries",
  },
  { field: "user-agent", needs: ["ua"], unlocks: "family classification" },
  { field: "response bytes", needs: ["resp_bytes"], unlocks: "empty-shell detection" },
  { field: "accept header", needs: ["accept"], unlocks: "stronger classification" },
  { field: "conditional headers", needs: ["conditional"], unlocks: "agent vs crawler" },
  { field: "response timing", needs: ["duration_ms"], unlocks: "retry-cause analysis" },
  { field: "real-time delivery", needs: [], realtime: true, unlocks: "alerts, fix verification" },
];

/** The field-coverage matrix ("Missing from this log export"). */
export function coverageMatrix(fieldMap: FieldMap): CoverageRow[] {
  return COVERAGE_SPEC.map((row) => ({
    field: row.field,
    present: row.realtime ? fieldMap.realtime : row.needs.every((f) => fieldMap.fields.includes(f)),
    unlocks: row.unlocks,
  }));
}
