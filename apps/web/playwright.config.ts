import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

/**
 * Dashboard e2e (Phase 5): login-gated access, every module renders with numbers equal to core's
 * golden aggregates, empty states, and cross-tenant isolation (a security test).
 *
 * Fully hermetic: the app runs on PGlite (embedded Postgres) with the e2e Credentials provider,
 * seeded from the checked-in demo fixture. No external database, Tinybird, or GitHub OAuth needed.
 */
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const PORT = 3123;
const pgliteDir = join(here, ".e2e-pglite");

const serverEnv = {
  FOOTFALL_E2E: "1",
  FOOTFALL_PGLITE: "1",
  FOOTFALL_PGLITE_DIR: pgliteDir,
  FOOTFALL_FIXTURE_ROOT: repoRoot,
  AUTH_SECRET: "e2e-test-secret-do-not-use-in-prod",
  AUTH_URL: `http://localhost:${PORT}`,
};

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  forbidOnly: !!process.env.CI,
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    // Build, then reset + seed a fresh PGlite DB, then start. Sequential so the DB has one writer.
    command: `rm -rf "${pgliteDir}" && next build && tsx ../../scripts/seed.ts && next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: serverEnv,
  },
});
