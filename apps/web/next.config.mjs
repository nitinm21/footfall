import { join } from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: join(import.meta.dirname, "..", ".."),
  transpilePackages: ["@footfall/core"],
};

export default nextConfig;
