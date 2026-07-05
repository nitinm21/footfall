/**
 * Register a live (Tinybird-backed) site in the metadata DB. A stop-gap until Phase 6's
 * self-serve onboarding — lets an operator's own instrumented sites appear on the dashboard.
 * Ownership is granted on first sign-in via FOOTFALL_OWNER_EMAIL.
 *
 *   tsx scripts/add-site.ts <token> [display name]
 *   tsx scripts/add-site.ts nitinmurali.vercel.app "Portfolio"
 */

import { db } from "../apps/web/db/index";
import { migrateDb } from "../apps/web/db/migrate";
import { sites } from "../apps/web/db/schema";

const [token, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(" ") || token;

if (!token) {
  console.error("usage: tsx scripts/add-site.ts <token> [display name]");
  process.exit(1);
}

await migrateDb();
await db
  .insert(sites)
  .values({ token, name, source: "live", fixture: null })
  .onConflictDoUpdate({ target: sites.token, set: { name, source: "live", fixture: null } });

console.log(`upserted live site: ${token} (${name})`);
process.exit(0);
