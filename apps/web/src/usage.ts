// Per-site daily ingest counter (Postgres) behind the ingest cap. Atomic increment so the cap
// holds across serverless instances. No-op (no DB write) when uncapped, so it's free by default.

import { and, db, eq, sql } from "../db";
import { siteUsage } from "../db/schema";
import { applyCap, type CapDecision } from "./cap";

export function ingestDailyCap(env: NodeJS.ProcessEnv = process.env): number {
  return Number.parseInt(env.FOOTFALL_INGEST_DAILY_CAP ?? "0", 10) || 0;
}

export function utcDay(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** Record `eventCount` against today's counter and decide accept/drop for the ingest cap. */
export async function recordUsage(
  site: string,
  eventCount: number,
  cap = ingestDailyCap(),
): Promise<CapDecision> {
  if (cap <= 0) return { accept: eventCount, drop: 0 };
  const day = utcDay();

  const [row] = await db
    .insert(siteUsage)
    .values({ token: site, day, received: eventCount })
    .onConflictDoUpdate({
      target: [siteUsage.token, siteUsage.day],
      set: { received: sql`${siteUsage.received} + ${eventCount}` },
    })
    .returning({ received: siteUsage.received });

  const receivedAfter = row?.received ?? eventCount;
  const decision = applyCap(receivedAfter - eventCount, eventCount, cap);
  if (decision.drop > 0) {
    await db
      .update(siteUsage)
      .set({ dropped: sql`${siteUsage.dropped} + ${decision.drop}` })
      .where(and(eq(siteUsage.token, site), eq(siteUsage.day, day)));
  }
  return decision;
}

/** Total events dropped for a site over the last `days` — drives the dashboard sampling notice. */
export async function droppedSince(site: string, sinceDay: string): Promise<number> {
  const rows = await db
    .select({ dropped: siteUsage.dropped })
    .from(siteUsage)
    .where(and(eq(siteUsage.token, site), sql`${siteUsage.day} >= ${sinceDay}`));
  return rows.reduce((n, r) => n + (r.dropped ?? 0), 0);
}
