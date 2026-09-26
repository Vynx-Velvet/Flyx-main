import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Single source of truth for the release version shown in the UI and
// reported by /api/health: this package's own version field.
const APP_VERSION: string = (() => {
  try {
    return String(JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8")).version || "0.0.0");
  } catch {
    return "0.0.0";
  }
})();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
  },
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
