// Dual-driver Drizzle client. Production uses Neon (serverless Postgres, provisioned via
// Vercel). Dev / test / CI use PGlite (embedded Postgres, file-backed) so the whole suite —
// seeding, dashboard, isolation e2e — runs hermetically with no external database or secrets.
// The Drizzle query surface is identical across pg drivers, so app code is driver-agnostic.

import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema";

/** App code types against this; the Neon client is structurally compatible at runtime. */
export type AppDb = PgliteDatabase<typeof schema>;

const PLACEHOLDER = "user:password@host";

/** True when there is no real Postgres to talk to (unset/placeholder URL, or forced). */
export function usePglite(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.FOOTFALL_PGLITE === "1") return true;
  const url = env.DATABASE_URL;
  return !url || url.includes(PLACEHOLDER);
}

/** Where the embedded PGlite database lives. Set explicitly in seed + e2e for determinism. */
export function pgliteDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.FOOTFALL_PGLITE_DIR ?? join(tmpdir(), "footfall-pglite");
}

let cached: AppDb | undefined;

export function getDb(): AppDb {
  if (cached) return cached;
  if (usePglite()) {
    cached = drizzlePglite(new PGlite(pgliteDir()), { schema }) as AppDb;
  } else {
    cached = drizzleNeon(neon(process.env.DATABASE_URL as string), {
      schema,
    }) as unknown as AppDb;
  }
  return cached;
}

// Constructed eagerly: the Auth.js Drizzle adapter inspects the db object synchronously to detect
// the dialect, so a lazy proxy breaks it. PGlite defers its real FS/WASM open until the first
// query, so importing this module (e.g. during `next build`) doesn't open a connection.
export const db = getDb();

// Re-export the operators callers need, so root-level scripts (scripts/seed.ts) can import
// everything from here and never resolve drizzle-orm from the repo root (where it isn't installed).
export { and, eq, sql } from "drizzle-orm";
export { schema };
