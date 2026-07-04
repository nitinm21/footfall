/** Runtime config, from env vars only (no code changes to toggle behaviour). */
export interface FootfallConfig {
  /** Per-site write token. No token → middleware is inert. */
  token: string | null;
  /** Where to POST events. */
  ingestUrl: string;
  /** Kill switch: FOOTFALL_DISABLED=1 stops all emission. */
  disabled: boolean;
  /** Server-side salt base for IP hashing; combined with the date for daily rotation. */
  ipSalt: string;
  /** Per-instance daily soft cap; 0 = uncapped. Above it, events are sampled. */
  dailyCap: number;
  /** Hard timeout on the ingest send (ms). */
  timeoutMs: number;
}

function truthy(v: string | undefined): boolean {
  return v === "1" || v === "true" || v === "yes";
}

export function readConfig(env: Record<string, string | undefined> = process.env): FootfallConfig {
  return {
    token: env.FOOTFALL_TOKEN ?? null,
    ingestUrl: env.FOOTFALL_INGEST_URL ?? "",
    disabled: truthy(env.FOOTFALL_DISABLED),
    ipSalt: env.FOOTFALL_IP_SALT ?? "footfall",
    dailyCap: Number.parseInt(env.FOOTFALL_DAILY_CAP ?? "0", 10) || 0,
    timeoutMs: Number.parseInt(env.FOOTFALL_TIMEOUT_MS ?? "500", 10) || 500,
  };
}

/** Whether the middleware should emit at all (token present + not killed). */
export function isActive(cfg: FootfallConfig): boolean {
  return !cfg.disabled && cfg.token !== null && cfg.token !== "" && cfg.ingestUrl !== "";
}
