import { defineConfig } from "tsup";

// Bundle the workspace @footfall/core dependency into the published output so consumers install a
// single self-contained package. `next` stays external (it's a peer dependency).
export default defineConfig({
  entry: ["src/index.ts", "src/beacon.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  treeshake: true,
  noExternal: [/@footfall\/core/],
  external: ["next", /^next\//],
});
