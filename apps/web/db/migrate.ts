// Apply the checked-in migrations to whichever driver is active (Neon or PGlite).
// Used by scripts/seed.ts and the `db:migrate` script.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { db, usePglite } from "./index";

export async function migrateDb(): Promise<void> {
  const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "migrations");
  if (usePglite()) {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    // biome-ignore lint/suspicious/noExplicitAny: see note above.
    await migrate(db as any, { migrationsFolder });
  } else {
    const { migrate } = await import("drizzle-orm/neon-http/migrator");
    // biome-ignore lint/suspicious/noExplicitAny: see note above.
    await migrate(db as any, { migrationsFolder });
  }
}

// Allow `tsx apps/web/db/migrate.ts` to run migrations directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateDb()
    .then(() => {
      console.log("migrations applied");
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
