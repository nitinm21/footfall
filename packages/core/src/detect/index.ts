// detect/ — the failure taxonomy. All countable, except empty_shell (flagged heuristic).

import type { Event } from "../schema";
import type { ClassifiedSession, DemandKind, DemandSignal, FailureFinding } from "../types";

export const RETRY_WINDOW_MS = 60_000;
export const RETRY_MIN_HITS = 3;
/** HTML responses smaller than this look like empty JS shells (heuristic). */
export const EMPTY_SHELL_MAX_BYTES = 3072;

const isAgent = (s: ClassifiedSession) => s.classification.class === "agent";

interface Acc {
  path: string;
  agentHits: number;
  totalHits: number;
  sessionIds: Set<string>;
}

function aggregate(sessions: ClassifiedSession[], match: (e: Event) => boolean): Map<string, Acc> {
  const byPath = new Map<string, Acc>();
  for (const s of sessions) {
    const agent = isAgent(s);
    for (const e of s.events) {
      if (!match(e)) continue;
      let acc = byPath.get(e.path);
      if (!acc) {
        acc = { path: e.path, agentHits: 0, totalHits: 0, sessionIds: new Set() };
        byPath.set(e.path, acc);
      }
      acc.totalHits += 1;
      if (agent) acc.agentHits += 1;
      acc.sessionIds.add(s.id);
    }
  }
  return byPath;
}

function toFindings(
  accs: Map<string, Acc>,
  type: FailureFinding["type"],
  heuristic: boolean,
): FailureFinding[] {
  return [...accs.values()]
    .map((a) => ({
      type,
      path: a.path,
      agentHits: a.agentHits,
      totalHits: a.totalHits,
      heuristic,
      sessionIds: [...a.sessionIds].sort(),
    }))
    .sort(
      (a, b) =>
        b.agentHits - a.agentHits || b.totalHits - a.totalHits || a.path.localeCompare(b.path),
    );
}

export function detectDeadEnds(sessions: ClassifiedSession[]): FailureFinding[] {
  return toFindings(
    aggregate(sessions, (e) => e.status === 404 || e.status === 410),
    "dead_end",
    false,
  );
}

export function detectAuthWalls(sessions: ClassifiedSession[]): FailureFinding[] {
  return toFindings(
    aggregate(sessions, (e) => e.status === 401 || e.status === 403),
    "auth_wall",
    false,
  );
}

/** 200 HTML responses under the byte threshold, from agent sessions. Skipped when resp_bytes is null. */
export function detectEmptyShells(sessions: ClassifiedSession[]): FailureFinding[] {
  const agentOnly = sessions.filter(isAgent);
  return toFindings(
    aggregate(
      agentOnly,
      (e) =>
        e.method === "GET" &&
        e.status === 200 &&
        e.resp_bytes !== null &&
        e.resp_bytes > 0 && // 0 bytes = HEAD / no-body, not a rendered shell
        e.resp_bytes < EMPTY_SHELL_MAX_BYTES &&
        (e.content_type === null || /html/i.test(e.content_type)) &&
        !e.asset,
    ),
    "empty_shell",
    true,
  );
}

/** ≥3 identical-path fetches within a 60s window inside one session. */
export function detectRetryLoops(sessions: ClassifiedSession[]): FailureFinding[] {
  const byPath = new Map<string, Acc>();
  for (const s of sessions) {
    const agent = isAgent(s);
    const times = new Map<string, number[]>();
    for (const e of s.events) {
      const arr = times.get(e.path);
      if (arr) arr.push(e.ts);
      else times.set(e.path, [e.ts]);
    }
    for (const [path, tsList] of times) {
      tsList.sort((a, b) => a - b);
      let loopHits = 0;
      for (let i = 0; i + RETRY_MIN_HITS - 1 < tsList.length; i++) {
        const first = tsList[i];
        const last = tsList[i + RETRY_MIN_HITS - 1];
        if (first !== undefined && last !== undefined && last - first <= RETRY_WINDOW_MS) {
          loopHits = tsList.length; // the path is in a retry loop; count all its hits
          break;
        }
      }
      if (loopHits > 0) {
        let acc = byPath.get(path);
        if (!acc) {
          acc = { path, agentHits: 0, totalHits: 0, sessionIds: new Set() };
          byPath.set(path, acc);
        }
        acc.totalHits += loopHits;
        if (agent) acc.agentHits += loopHits;
        acc.sessionIds.add(s.id);
      }
    }
  }
  return toFindings(byPath, "retry_loop", false);
}

function demandKind(path: string): DemandKind {
  if (/^\/llms(-full)?\.txt$/i.test(path)) return "llms_txt";
  if (/openapi\.(json|ya?ml)$/i.test(path) || path === "/openapi") return "openapi";
  if (/\.md$/i.test(path)) return "markdown_mirror";
  if (/^\/(robots\.txt|sitemap\.xml|favicon\.ico)$/i.test(path)) return "other";
  return "moved_path"; // a real-looking page that 404s → likely moved/missing
}

/** 404 paths categorized as unmet agent demand (drives recommendations). */
export function detectDemand(deadEnds: FailureFinding[]): DemandSignal[] {
  return deadEnds
    .map((f) => ({
      kind: demandKind(f.path),
      path: f.path,
      count: f.totalHits,
      agentHits: f.agentHits,
    }))
    .sort((a, b) => b.agentHits - a.agentHits || b.count - a.count || a.path.localeCompare(b.path));
}

export interface Detections {
  deadEnds: FailureFinding[];
  authWalls: FailureFinding[];
  emptyShells: FailureFinding[];
  retryLoops: FailureFinding[];
  demand: DemandSignal[];
}

export function detect(sessions: ClassifiedSession[]): Detections {
  const deadEnds = detectDeadEnds(sessions);
  return {
    deadEnds,
    authWalls: detectAuthWalls(sessions),
    emptyShells: detectEmptyShells(sessions),
    retryLoops: detectRetryLoops(sessions),
    demand: detectDemand(deadEnds),
  };
}
