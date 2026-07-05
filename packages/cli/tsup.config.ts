import { defineConfig } from "tsup";

// Self-contained bin: bundle the workspace packages + zod so the published `footfall` has zero
// runtime dependencies (clean `npx footfall`). Node built-ins stay external.
export default defineConfig({
  entry: { footfall: "src/bin.ts" },
  format: ["esm"],
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
  noExternal: [/@footfall\//, "zod"],
});
