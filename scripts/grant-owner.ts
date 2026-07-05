/**
 * Grant a user owner access to a site by email + token (a manual bridge until Phase 6
 * onboarding). Safe to re-run.
 *
 *   tsx scripts/grant-owner.ts <email> <site-token>
 */

import { db, eq } from "../apps/web/db/index";
import { siteMembers, sites, users } from "../apps/web/db/schema";

const [email, token] = process.argv.slice(2);
if (!email || !token) {
  console.error("usage: tsx scripts/grant-owner.ts <email> <site-token>");
  process.exit(1);
}

const [s] = await db.select().from(sites).where(eq(sites.token, token)).limit(1);
if (!s) {
  console.error(`site '${token}' not found`);
  process.exit(1);
}

const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
if (!u) {
  console.log(`user '${email}' not in DB yet — they'll be auto-linked on next sign-in.`);
  process.exit(0);
}

await db
  .insert(siteMembers)
  .values({ siteId: s.id, userId: u.id, role: "owner" })
  .onConflictDoNothing();
console.log(`granted '${email}' owner of '${token}'`);
process.exit(0);
