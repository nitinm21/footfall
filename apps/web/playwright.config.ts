import { defineConfig } from "@playwright/test";

/**
 * Dashboard e2e (Phase 5): login-gated access, every module renders with correct
 * numbers against seeded data, empty states, and cross-tenant isolation (a security
 * test). A webServer entry pointing at the Next.js dev/preview build is added when
 * the app exists. Specs live in ./e2e.
 */
export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env.CI,
});
