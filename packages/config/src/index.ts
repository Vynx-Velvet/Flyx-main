/**
 * @flyx/config
 *
 * Shared configuration for Flyx 3.0.
 *
 * Provides:
 * - **Priorities** — Central provider priority table (single source of truth)
 * - **Env** — Validated environment variables (Zod schemas)
 * - **Constants** — Shared app-wide constants
 */

export {
  PROVIDER_PRIORITIES,
  validatePriorities,
  getProvidersByPriority,
  getPriority,
} from "./priorities";

export type { ProviderPriorityValue, ProviderName } from "./priorities";

export { envSchema, validateEnv, createEnv } from "./env";
export type { Env } from "./env";

export {
  CONTENT_CATEGORIES,
  PAGINATION,
  STREAM,
  RATE_LIMITS,
  CACHE_TTL,
  SYNC,
  PLAYBACK,
} from "./constants";
