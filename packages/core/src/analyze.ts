// analyze — the pure pipeline: Event[] → AnalysisResult (what the report & dashboard render).

import {
  agentSharePct,
  coverageMatrix,
  dailyRollup,
  failureTotals,
  familyBreakdown,
  topPagesByAgentDemand,
  totalRequests,
  trafficSplit,
} from "./aggregate";
import { classifyAll } from "./classify";
import { detect } from "./detect";
import type { FieldMap } from "./normalize/field-map";
import { recommend } from "./recommend";
import type { Event } from "./schema";
import { sessionize } from "./sessionize";
import type { AnalysisResult, FailureFinding } from "./types";

export interface AnalyzeOptions {
  /** Site token; defaults to the first event's site. */
  site?: string;
  /** Human-readable site name for the llms.txt draft. */
  siteName?: string;
  /** Base URL for generated links (defaults to https://<site>). */
  baseUrl?: string;
  /** One-line description for the llms.txt draft. */
  description?: string;
}

export function analyze(
  events: Event[],
  fieldMap: FieldMap,
  opts: AnalyzeOptions = {},
): AnalysisResult {
  const sessions = classifyAll(sessionize(events));
  const detections = detect(sessions);

  const site = opts.site ?? events[0]?.site ?? "unknown";
  const siteName = opts.siteName ?? site;
  const baseUrl = opts.baseUrl ?? `https://${site}`;

  const split = trafficSplit(sessions);
  const total = totalRequests(sessions);
  const unclassifiedReqs = split.find((r) => r.class === "unclassified")?.requests ?? 0;
  const classifiedPct = total ? Math.round(((total - unclassifiedReqs) / total) * 1000) / 10 : 0;

  const timestamps = events.map((e) => e.ts);
  const topPages = topPagesByAgentDemand(sessions);
  const { recommendations, llmsTxt } = recommend(detections, topPages, {
    siteName,
    baseUrl,
    ...(opts.description !== undefined ? { description: opts.description } : {}),
  });

  const failures: FailureFinding[] = [
    ...detections.deadEnds,
    ...detections.authWalls,
    ...detections.emptyShells,
    ...detections.retryLoops,
  ].sort(
    (a, b) =>
      b.agentHits - a.agentHits || b.totalHits - a.totalHits || a.path.localeCompare(b.path),
  );

  return {
    meta: {
      site,
      source: fieldMap.source,
      totalRequests: total,
      from: timestamps.length ? Math.min(...timestamps) : null,
      to: timestamps.length ? Math.max(...timestamps) : null,
      classifiedPct,
    },
    trafficSplit: split,
    agentSharePct: agentSharePct(sessions),
    daily: dailyRollup(sessions),
    families: familyBreakdown(sessions),
    topPages,
    failures,
    failureTotals: failureTotals(detections, fieldMap),
    demand: detections.demand,
    recommendations,
    llmsTxt,
    coverage: coverageMatrix(fieldMap),
    sessions,
  };
}
