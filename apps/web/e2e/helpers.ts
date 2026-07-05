import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { analyze, normalizeJsonl } from "@footfall/core";
import type { Page } from "@playwright/test";

const DAY = 86_400_000;
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** Log in as a seeded user via the env-gated e2e Credentials provider (no external OAuth). */
export async function login(page: Page, email: string): Promise<void> {
  const csrfRes = await page.request.get("/api/auth/csrf");
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  await page.request.post("/api/auth/callback/e2e", {
    form: { csrfToken, email, callbackUrl: "/" },
  });
}

export interface ExpectedKpis {
  agentRequests: number;
  agentSharePct: number;
  agentSessions: number;
  failedAgentRequests: number;
}

/**
 * Compute the demo site's expected KPIs straight from core over the same window the dashboard
 * uses (fixture: last 14 days anchored to the data's own last timestamp). This is the independent
 * oracle for the numbers-parity test — if the dashboard drifts from core, the assertion fails.
 */
export function expectedDemoKpis(): ExpectedKpis {
  const text = readFileSync(join(REPO_ROOT, "fixtures/demo/dashboard-demo.jsonl"), "utf8");
  const { events, fieldMap } = normalizeJsonl(text);
  const to = Math.max(...events.map((e) => e.ts)) + 1;
  const from = to - 14 * DAY;
  const cur = events.filter((e) => e.ts >= from && e.ts < to);
  const r = analyze(cur, fieldMap, { site: "demo" });
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
