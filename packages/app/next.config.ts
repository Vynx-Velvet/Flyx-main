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

const isDev = process.env.NODE_ENV === "development";

/**
 * Content-Security-Policy for every page.
 *
 * Scripts are locked down (self + Next's inline bootstrap + the Chromecast
 * sender SDK); connect-src/media-src stay open to any http(s) origin
 * because the player loads some streams straight from provider CDNs
 * (hls.js XHR / <video src>) and the CF media worker, and those hosts are
 * dynamic. img-src is open for the same reason (TMDB, anime/manga posters).
 * Frames: YouTube trailer embeds only.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.gstatic.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: http:",
  "font-src 'self' data:",
  "media-src 'self' blob: data: https: http:",
  `connect-src 'self' https: http:${isDev ? " ws: wss:" : ""}`,
  "worker-src 'self' blob:",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Not no-referrer: YouTube embeds refuse to play without a Referer, and
  // same-origin requests keep their full referrer either way.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // Pages only: API routes set their own policy (the media proxies send
      // `sandbox; default-src 'none'`), which must not be overridden.
      {
        source: "/((?!api/).*)",
        headers: [{ key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY }],
      },
    ];
  },
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
  ],
};

export default nextConfig;
