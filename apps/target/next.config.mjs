import { join } from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The rig is intentionally plain: no redirects for moved paths (they 404 on
  // purpose), no llms.txt (a demand signal), no auth beyond the /docs/private wall.
  reactStrictMode: true,
  // Transpile the workspace TS packages consumed by middleware/beacons.
  transpilePackages: ["@footfall/core", "@footfall/next"],
  // Pin the tracing root to the monorepo (a stray ~/package-lock.json otherwise
  // makes Next infer the wrong workspace root).
  outputFileTracingRoot: join(import.meta.dirname, "..", ".."),
};

export default nextConfig;
