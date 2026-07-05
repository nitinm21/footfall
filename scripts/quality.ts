/**
 * Per-site data-quality checks (Phase 7). For every site in the metadata DB: event volume,
 * classification rate, unclassified %, agent share, ingest cap/sampling status, and capture-gap
 * detection (days with zero events inside the observed span). Prints a table so a glance tells you
 * whether a site's data is trustworthy enough to cite in the launch post.
 *
 *   pnpm quality            # all sites
 *   pnpm quality <token>    # one site
 *
 * Env: DATABASE_URL (or PGlite) for the site list; TINYBIRD_TOKEN for live sites.
 */

import { analyze } from "@footfall/core";
import { db, eq } from "../apps/web/db/index";
import { type Site, sites } from "../apps/web/db/schema";
import { getSiteEvents } from "../apps/web/src/events-source";
import { droppedSince } from "../apps/web/src/usage";

const DAY = 86_400_000;
const WINDOW_DAYS = 30;

interface Row {
  site: string;
  source: string;
  events: number;
  days: number;
  span: string;
  classifiedPct: number;
  unclassifiedPct: number;
  agentPct: number;
  dropped: number;
  gaps: number;
  note: string;
}

function dayStr(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

async function checkSite(site: Site, now: number): Promise<Row> {
  const isFixture = site.source === "fixture";
  const since = isFixture ? 0 : now - WINDOW_DAYS * DAY;
  const until = isFixture ? Number.MAX_SAFE_INTEGER : now;
  const { events, fieldMap } = await getSiteEvents(site, since, until);

  const base: Row = {
    site: site.token,
    source: site.source,
    events: events.length,
    days: 0,
    span: "—",
    classifiedPct: 0,
    unclassifiedPct: 0,
    agentPct: 0,
    dropped: 0,
    gaps: 0,
    note: "",
  };
  if (events.length === 0) return { ...base, note: "no data yet" };

  const r = analyze(events, fieldMap, { site: site.token, siteName: site.name });
  const unclassified = r.trafficSplit.find((t) => t.class === "unclassified")?.pct ?? 0;

  const firstTs = Math.min(...events.map((e) => e.ts));
  const lastTs = Math.max(...events.map((e) => e.ts));
  const spanDays = Math.floor((lastTs - firstTs) / DAY) + 1;
  const daysWithData = r.daily.length;
  const gaps = Math.max(0, spanDays - daysWithData);

  const notes: string[] = [];
  if (spanDays < 14) notes.push("<2wk of data");
  if (unclassified > 20) notes.push("high unclassified");
  if (gaps > 0) notes.push(`${gaps} gap-day(s)`);

  const dropped = site.source === "live" ? await droppedSince(site.token, dayStr(since)) : 0;
  if (dropped > 0) notes.push("sampled (cap hit)");

  return {
    ...base,
    days: daysWithData,
    span: `${dayStr(firstTs)}→${dayStr(lastTs)}`,
    classifiedPct: r.meta.classifiedPct,
    unclassifiedPct: unclassified,
    agentPct: r.agentSharePct,
    dropped,
    gaps,
    note: notes.join("; ") || "ok",
  };
}

function printTable(rows: Row[]): void {
  const header = [
    "site",
    "src",
    "events",
    "days",
    "span",
    "class%",
    "uncl%",
    "agent%",
    "dropped",
    "note",
  ];
  const data = rows.map((r) => [
    r.site,
    r.source,
    String(r.events),
    String(r.days),
    r.span,
    String(r.classifiedPct),
    String(r.unclassifiedPct),
    String(r.agentPct),
    String(r.dropped),
    r.note,
  ]);
  const widths = header.map((h, i) =>
    Math.max(h.length, ...data.map((row) => row[i]?.length ?? 0)),
  );
  const fmt = (cols: string[]) => cols.map((c, i) => c.padEnd(widths[i] ?? 0)).join("  ");
  console.log(fmt(header));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of data) console.log(fmt(row));
}

async function main(): Promise<void> {
  const token = process.argv[2];
  const now = Date.now();
  const list = token
    ? await db.select().from(sites).where(eq(sites.token, token))
    : await db.select().from(sites);
  if (list.length === 0) {
    console.log(token ? `no site with token ${token}` : "no sites in the DB");
    process.exit(0);
  }
  const rows: Row[] = [];
  for (const site of list) rows.push(await checkSite(site, now));
  printTable(rows);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
