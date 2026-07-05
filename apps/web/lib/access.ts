// Access control — the multi-tenant isolation boundary. A user may see a site ONLY through a
// site_members row. Cross-tenant lookups return null (the caller 404s), so we never even
// disclose that another tenant's site exists.

import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { type Site, siteMembers, sites } from "../db/schema";

/** Every site the user is a member of. */
export async function listUserSites(userId: string): Promise<Site[]> {
  const rows = await db
    .select()
    .from(sites)
    .innerJoin(siteMembers, eq(siteMembers.siteId, sites.id))
    .where(eq(siteMembers.userId, userId));
  return rows.map((r) => r.sites);
}

/** The site with this token IFF the user is a member; otherwise null (treat as 404). */
export async function getAccessibleSite(userId: string, token: string): Promise<Site | null> {
  const rows = await db
    .select()
    .from(sites)
    .innerJoin(siteMembers, eq(siteMembers.siteId, sites.id))
    .where(and(eq(sites.token, token), eq(siteMembers.userId, userId)))
    .limit(1);
  return rows[0]?.sites ?? null;
}
