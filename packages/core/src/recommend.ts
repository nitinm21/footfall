// recommend — rule table over detector aggregates → ranked fixes + an llms.txt draft.

import type { Detections } from "./detect";
import type { DemandSignal, Recommendation, TopPageRow } from "./types";

export interface RecommendContext {
  siteName: string;
  baseUrl: string;
  description?: string;
}

function sumBy(
  signals: DemandSignal[],
  kind: DemandSignal["kind"],
): { count: number; agentHits: number; paths: string[] } {
  const matching = signals.filter((s) => s.kind === kind);
  return {
    count: matching.reduce((n, s) => n + s.count, 0),
    agentHits: matching.reduce((n, s) => n + s.agentHits, 0),
    paths: matching.map((s) => s.path),
  };
}

function titleize(path: string): string {
  const seg = path.replace(/\/+$/, "").split("/").filter(Boolean).pop();
  if (!seg) return "Home";
  return seg
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Rank fixes by the demand/failure count that justifies them. */
export function recommend(
  detections: Detections,
  topPages: TopPageRow[],
  ctx: RecommendContext,
): { recommendations: Recommendation[]; llmsTxt: string } {
  const recs: Recommendation[] = [];

  const llms = sumBy(detections.demand, "llms_txt");
  if (llms.agentHits > 0) {
    recs.push({
      title: "Publish /llms.txt and /llms-full.txt",
      detail: `${llms.agentHits} agent dead-ends on ${llms.paths.join(", ")}`,
      metric: llms.agentHits,
      heuristic: false,
    });
  }

  const md = sumBy(detections.demand, "markdown_mirror");
  if (md.agentHits > 0) {
    recs.push({
      title: "Serve markdown mirrors for top agent pages",
      detail: `${md.agentHits} agent requests to ${md.paths.slice(0, 3).join(", ")}`,
      metric: md.agentHits,
      heuristic: false,
    });
  }

  const openapi = sumBy(detections.demand, "openapi");
  if (openapi.agentHits > 0) {
    recs.push({
      title: "Publish /openapi.json",
      detail: `${openapi.agentHits} agent requests`,
      metric: openapi.agentHits,
      heuristic: false,
    });
  }

  const moved = sumBy(detections.demand, "moved_path");
  if (moved.agentHits > 0) {
    recs.push({
      title: "Add 301 redirects for moved pages",
      detail: `${moved.agentHits} agent dead-ends on ${moved.paths.slice(0, 3).join(", ")}`,
      metric: moved.agentHits,
      heuristic: false,
    });
  }

  const topShell = detections.emptyShells[0];
  const shellHits = detections.emptyShells.reduce((n, f) => n + f.totalHits, 0);
  if (topShell && shellHits > 0) {
    recs.push({
      title: `Static-render ${topShell.path}`,
      detail: `${shellHits} empty-shell fetches by agents`,
      metric: shellHits,
      heuristic: true,
    });
  }

  const authHits = detections.authWalls.reduce((n, f) => n + f.agentHits, 0);
  const topAuth = detections.authWalls[0];
  if (topAuth && authHits > 0) {
    recs.push({
      title: `Document or open agent access to ${topAuth.path}`,
      detail: `${authHits} agent requests hit an auth wall`,
      metric: authHits,
      heuristic: false,
    });
  }

  recs.sort((a, b) => b.metric - a.metric || a.title.localeCompare(b.title));

  return { recommendations: recs, llmsTxt: generateLlmsTxt(topPages, ctx) };
}

/** Draft an llms.txt from the pages agents actually request most. */
export function generateLlmsTxt(topPages: TopPageRow[], ctx: RecommendContext): string {
  const description = ctx.description ?? "Project documentation.";
  const base = ctx.baseUrl.replace(/\/+$/, "");
  const links = topPages
    .filter((p) => p.agentRequests > 0)
    .slice(0, 8)
    .map((p) => `- [${titleize(p.path)}](${base}${p.path})`);
  const body = links.length ? links.join("\n") : "- (no agent page demand observed yet)";
  return `# ${ctx.siteName}
> ${description}

## Docs
${body}
`;
}
