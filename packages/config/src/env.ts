/**
 * Environment variable validation using Zod.
 *
 * Validates all required environment variables at startup,
 * providing clear error messages instead of cryptic runtime failures.
 *
 * In Flyx 2.0, env vars were accessed via `process.env.X` with
 * no validation. This led to production issues where missing
 * variables caused opaque errors in Cloudflare Workers.
 *
 * @module env
 */

import { z } from "zod";

/** Schema for all environment variables. */
export const envSchema = z.object({
  // TMDB
  TMDB_API_KEY: z.string().min(1, "TMDB_API_KEY is required"),

  // Auth
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),

  // Database
  DATABASE_URL: z.string().optional(),

  // Cloudflare
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_API_TOKEN: z.string().optional(),

  // Stripe (optional — only for monetised deployments)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Discord (optional — only for bot integration)
  DISCORD_PUBLIC_KEY: z.string().optional(),
  DISCORD_BOT_TOKEN: z.string().optional(),

  // Feature flags
  ENABLE_ANALYTICS: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  ENABLE_SYNC: z
    .string()
    .optional()
    .transform((v) => v !== "false"), // Enabled by default
  ENABLE_STREAM_PROXY: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
  // Host-only account creation key
  HOST_KEY: z.string().optional(),

  // Node environment
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

/** Inferred type for validated environment variables. */
export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables.
 *
 * @param raw - Raw environment object (e.g., `process.env`).
 * @returns Validated and typed environment.
 * @throws {ZodError} If validation fails, with clear messages.
 */
export function validateEnv(raw: Record<string, string | undefined>): Env {
  return envSchema.parse(raw);
}

/**
 * Create a type-safe environment accessor.
 *
 * Use this instead of `process.env.X` throughout the app.
 *
 * @example
 * ```ts
 * const env = createEnv(process.env);
 * console.log(env.TMDB_API_KEY); // typed as string
 * ```
 */
export function createEnv(raw: Record<string, string | undefined>): Env {
  return validateEnv(raw);
}
