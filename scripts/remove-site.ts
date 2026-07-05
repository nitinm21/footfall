/**
 * Remove a site (and, via cascade, its members + fixes) from the metadata DB. Admin helper.
 *
 *   tsx scripts/remove-site.ts <token>
 */

import { db, eq } from "../apps/web/db/index";
import { sites } from "../apps/web/db/schema";

const token = process.argv[2];
if (!token) {
  console.error("usage: tsx scripts/remove-site.ts <token>");
  process.exit(1);
}

const removed = await db
  .delete(sites)
  .where(eq(sites.token, token))
  .returning({ token: sites.token });
console.log(
  removed.length ? `removed site: ${token} (members + fixes cascaded)` : `no site: ${token}`,
);
process.exit(0);
