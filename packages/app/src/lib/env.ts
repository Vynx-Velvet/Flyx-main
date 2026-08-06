/**
 * Environment detection and deployment adapter.
 *
 * Flyx 3.0 runs in two modes:
 * - **local** — Next.js dev server with SQLite, Bun proxy
 * - **cloudflare** — Cloudflare Pages/Workers with D1, KV, Workers
 *
 * Set FLYX_DEPLOY_TARGET=cloudflare to switch to Cloudflare mode.
 * The default (unset) is local development mode.
 */

export type DeploymentTarget = "local" | "cloudflare" | "docker" | "vercel";

/**
 * Detect the current deployment target.
 *
 * Priority:
 * 1. `FLYX_DEPLOY_TARGET` env var (explicit override)
 * 2. `globalThis.__cf_env__` (Cloudflare runtime detection)
 * 3. Default: "local"
 */
export function detectDeploymentTarget(): DeploymentTarget {
  // Explicit env var
  const envTarget = process.env.FLYX_DEPLOY_TARGET;
  if (envTarget === "cloudflare" || envTarget === "docker" || envTarget === "vercel") {
    return envTarget;
  }

  // Cloudflare runtime detection
  if (typeof globalThis !== "undefined" && (globalThis as Record<string, unknown>).__cf_env__) {
    return "cloudflare";
  }

  // Docker detection
  if (process.env.DOCKER_ENV === "true" || process.env.FLYX_DOCKER === "true") {
    return "docker";
  }

  return "local";
}

/**
 * Get the current deployment target (cached).
 */
export const DEPLOYMENT_TARGET: DeploymentTarget = detectDeploymentTarget();

/**
 * Check if running in local development mode.
 */
export const isLocal = DEPLOYMENT_TARGET === "local";

/**
 * Check if running on Cloudflare infrastructure.
 */
export const isCloudflare = DEPLOYMENT_TARGET === "cloudflare";

/**
 * Check if running in Docker.
 */
export const isDocker = DEPLOYMENT_TARGET === "docker";

/**
 * Check if running on Vercel.
 */
export const isVercel = DEPLOYMENT_TARGET === "vercel";

/**
 * Get the appropriate database adapter based on deployment target.
 */
export function getDatabaseConfig() {
  switch (DEPLOYMENT_TARGET) {
    case "local":
      return { type: "sqlite" as const, path: "./flyx.db" };
    case "cloudflare":
      return { type: "d1" as const, binding: "DB" };
    case "docker":
      return { type: "sqlite" as const, path: "/data/flyx.db" };
    case "vercel":
      return { type: "postgres" as const, url: process.env.DATABASE_URL };
  }
}

/**
 * Log the deployment target at startup for debugging.
 */
console.log(`[Flyx 3.0] Deployment target: ${DEPLOYMENT_TARGET}`);
console.log(`[Flyx 3.0] Database: ${getDatabaseConfig().type}`);
