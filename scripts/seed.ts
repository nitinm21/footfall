/**
 * Seeded demo mode (Phase 5, task 4). Loads the demo dataset into the metadata DB so the
 * dashboard is fully demonstrable with no real traffic, and provides the fixtures the e2e suite
 * runs against:
 *   - demo        full sample data (owned by the demo user) + a marked /llms.txt fix
 *   - quiet-demo  no events (owned by the demo user) → exercises empty states
 *   - acme        full data owned by a DIFFERENT user → the cross-tenant isolation target
 *
 * Driver-agnostic (PGlite locally/CI, Neon in prod) via apps/web/db. Deterministic.
 *
 *   pnpm --filter @footfall/web seed        # or: tsx scripts/seed.ts
 */

import { db, eq } from "../apps/web/db/index";
import { migrateDb } from "../apps/web/db/migrate";
import { fixes, siteMembers, sites, users } from "../apps/web/db/schema";

const DEMO_FIXTURE = "fixtures/demo/dashboard-demo.jsonl";
const EMPTY_FIXTURE = "fixtures/demo/empty.jsonl";
const FIX_TS = Date.UTC(2026, 6, 8); // 2026-07-08, matches the generated fix-day in the dataset

async function upsertUser(email: string, name: string) {
  await db.insert(users).values({ email, name }).onConflictDoNothing();
  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!u) throw new Error(`failed to upsert user ${email}`);
  return u;
}

async function upsertSite(
  token: string,
  name: string,
  source: "live" | "fixture",
  fixture: string | null,
) {
  await db
    .insert(sites)
    .values({ token, name, source, fixture })
    .onConflictDoUpdate({ target: sites.token, set: { name, source, fixture } });
  const [s] = await db.select().from(sites).where(eq(sites.token, token)).limit(1);
  if (!s) throw new Error(`failed to upsert site ${token}`);
  return s;
}

async function link(siteId: string, userId: string, role: "owner" | "member") {
  await db.insert(siteMembers).values({ siteId, userId, role }).onConflictDoNothing();
}

async function main(): Promise<void> {
  await migrateDb();

  const demoUser = await upsertUser("demo@footfall.local", "Demo User");
  const acmeUser = await upsertUser("acme@footfall.local", "Acme Owner");

  const demoSite = await upsertSite("demo", "modelkit.dev · demo", "fixture", DEMO_FIXTURE);
  const emptySite = await upsertSite("quiet-demo", "quiet.dev · demo", "fixture", EMPTY_FIXTURE);
  const acmeSite = await upsertSite("acme", "acme.example · demo", "fixture", DEMO_FIXTURE);

  await link(demoSite.id, demoUser.id, "owner");
  await link(emptySite.id, demoUser.id, "owner");
  await link(acmeSite.id, acmeUser.id, "owner"); // demo user is NOT a member → isolation boundary

  await db
    .insert(fixes)
    .values({
      siteId: demoSite.id,
      path: "/llms.txt",
      type: "dead_end",
      markedDeployedAt: new Date(FIX_TS),
    })
    .onConflictDoUpdate({
      target: [fixes.siteId, fixes.path],
      set: { markedDeployedAt: new Date(FIX_TS), type: "dead_end" },
    });

  console.log("seeded: demo (full + /llms.txt fix), quiet-demo (empty), acme (other tenant)");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
