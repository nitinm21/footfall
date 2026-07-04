import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit/golden tests only; Playwright e2e specs live in ./e2e and run via `test:e2e`.
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
  },
});
