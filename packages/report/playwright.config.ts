import { defineConfig, devices } from "@playwright/test";

/**
 * Report e2e: `tsx e2e/gen-fixtures.ts` renders report HTML into e2e/.generated,
 * then these specs open the files (file://) and assert zero console errors, charts
 * present with labels, heuristic flags visible, and coverage grey-out.
 */
export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
