import { join } from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: join(import.meta.dirname, "..", ".."),
  transpilePackages: ["@footfall/core", "@footfall/report"],
  // PGlite (dev/test DB) ships WASM + data files and resolves them from disk; bundling breaks that
  // resolution, so keep it external and require it normally at runtime. Neon is fetch-based but
  // externalising it too avoids pulling the driver into the bundle.
  serverExternalPackages: ["@electric-sql/pglite", "@neondatabase/serverless"],
};

export default nextConfig;
