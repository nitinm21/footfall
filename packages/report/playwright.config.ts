import { defineConfig } from "@playwright/test";

/**
 * Report e2e (Phase 3): open a generated static report file and assert it renders
 * with zero console errors, charts present, heuristic flags visible, and greyed-out
 * modules when a low-fidelity fixture is used. Specs live in ./e2e.
 */
export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env.CI,
});
