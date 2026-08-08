import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone output for desktop packaging (bundles Node.js server)
  output: process.env.FLYX_STANDALONE === "1" ? "standalone" : undefined,
  // Skip type checking during build — type errors are caught by `npm run type-check` separately
  typescript: {
    ignoreBuildErrors: true,
  },
  transpilePackages: [
    "@flyx/core",
    "@flyx/config",
    "@flyx/providers",
    "@flyx/extractors",
    "@flyx/player",
    "@flyx/shared",
    "@flyx/admin",
    "@flyx/sync",
    "@flyx/db",
  ],
};

export default nextConfig;
