/**
 * @flyx/providers
 *
 * Provider system for Flyx 3.0.
 *
 * Provides:
 * - **BaseProvider** — Abstract base class eliminating ~85% boilerplate
 * - **BaseAnimeProvider** — Specialised for anime content
 * - **BaseLiveTVProvider** — Specialised for live TV
 * - **ProviderRegistry** — Central registry with priority-based routing
 * - **20+ providers** — Thin classes (15-30 lines each)
 *
 * @example
 * ```ts
 * import { providerRegistry } from "@flyx/providers";
 * import "@flyx/providers/providers"; // Auto-registers all providers
 *
 * const providers = providerRegistry.getForContent("movie");
 * ```
 */

export { BaseProvider, BaseAnimeProvider, BaseLiveTVProvider } from "./base";
export { ProviderRegistry, providerRegistry } from "./registry";
export type { Provider } from "./registry";
