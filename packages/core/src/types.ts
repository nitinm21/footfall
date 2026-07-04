import type { Event } from "./schema";

/** Top-level visitor classes shown in the traffic split. `unclassified` is never forced. */
export type VisitorClass = "agent" | "human" | "crawler" | "unclassified";

/** Classifier confidence, mirrored in the dashboard's confidence chips. */
export type Confidence = "high" | "medium" | "low";

/** A reconstructed visit: contiguous requests sharing (site, ip_hash, ua_fingerprint). */
export interface Session {
  /** Stable, deterministic id derived from the session key + start time. */
  id: string;
  site: string;
  ipHash: string;
  uaFingerprint: string;
  ua: string | null;
  /** First and last event timestamps (epoch ms). */
  start: number;
  end: number;
  events: Event[];
}

/** The behavioural feature vector a session is classified from (and shown as receipts). */
export interface SessionFeatures {
  requests: number;
  assetRequests: number;
  pageRequests: number;
  /** assetRequests / requests, 0..1. A top discriminator: agents ≈ 0, browsers high. */
  assetRatio: number;
  uniquePaths: number;
  /** Fraction of requests whose Accept header prefers markdown. Null if no Accept seen. */
  markdownAcceptRatio: number | null;
  /** Fraction of requests carrying If-None-Match / If-Modified-Since. */
  conditionalRatio: number;
  hasUa: boolean;
  /** Any Sec-Fetch-* header seen — a browser fingerprint. */
  hasSecFetch: boolean;
  /** Median gap between consecutive requests (ms). Null for single-request sessions. */
  medianGapMs: number | null;
  notFound: number;
  authBlocked: number;
  serverErrors: number;
}

/** One line of a classification receipt (`present` renders ✓, otherwise —). */
export interface ReceiptSignal {
  text: string;
  present: boolean;
}

/** Human-readable evidence for a classification, exactly as the mock's receipt panel shows. */
export interface Receipt {
  summary: string;
  signals: ReceiptSignal[];
}

export interface Classification {
  class: VisitorClass;
  /** e.g. "claude-code", "googlebot", "browser", "unidentified", "codex-suspect", or null. */
  family: string | null;
  confidence: Confidence;
  /** Which tier decided: 1 UA-exact, 2 browser, 3 behavioural, null unclassified. */
  tier: 1 | 2 | 3 | null;
  /** True when the label is a behavioural estimate (flagged in the UI). */
  heuristic: boolean;
  receipt: Receipt;
}

export interface ClassifiedSession extends Session {
  features: SessionFeatures;
  classification: Classification;
}

export type FailureType = "dead_end" | "auth_wall" | "empty_shell" | "retry_loop";

/** A detected failure, aggregated by path. */
export interface FailureFinding {
  type: FailureType;
  path: string;
  /** Requests from sessions classified as agents. */
  agentHits: number;
  totalHits: number;
  /** True for detectors that are heuristic (empty_shell). */
  heuristic: boolean;
  sessionIds: string[];
}

export type DemandKind = "llms_txt" | "openapi" | "markdown_mirror" | "moved_path" | "other";

/** A 404 pattern that signals unmet agent demand (drives recommendations). */
export interface DemandSignal {
  kind: DemandKind;
  path: string;
  count: number;
  agentHits: number;
}

export interface Recommendation {
  title: string;
  detail: string;
  /** The count that justifies the fix (dead-ends, requests, …); used for ranking. */
  metric: number;
  heuristic: boolean;
}

/** One row of the field-coverage matrix ("Missing from this log export"). */
export interface CoverageRow {
  field: string;
  present: boolean;
  unlocks: string;
}

export interface TrafficSplitRow {
  class: VisitorClass;
  requests: number;
  sessions: number;
  pct: number;
}

export interface DailyRow {
  date: string;
  agent: number;
  human: number;
  crawler: number;
  unclassified: number;
}

export interface FamilyRow {
  family: string;
  class: VisitorClass;
  requests: number;
  sessions: number;
  heuristic: boolean;
}

export interface TopPageRow {
  path: string;
  agentRequests: number;
  humanRequests: number;
  agentSharePct: number;
}

export interface FailureTotals {
  dead_end: number;
  auth_wall: number;
  empty_shell: number;
  retry_loop: number;
  /** True when empty_shell is being reported as a heuristic (resp_bytes present). */
  empty_shell_available: boolean;
}

export interface AnalysisMeta {
  site: string;
  source: string;
  totalRequests: number;
  from: number | null;
  to: number | null;
  classifiedPct: number;
}

/** Everything the report and dashboard render. Produced by `analyze()`. */
export interface AnalysisResult {
  meta: AnalysisMeta;
  trafficSplit: TrafficSplitRow[];
  agentSharePct: number;
  daily: DailyRow[];
  families: FamilyRow[];
  topPages: TopPageRow[];
  failures: FailureFinding[];
  failureTotals: FailureTotals;
  demand: DemandSignal[];
  recommendations: Recommendation[];
  llmsTxt: string;
  coverage: CoverageRow[];
  sessions: ClassifiedSession[];
}
