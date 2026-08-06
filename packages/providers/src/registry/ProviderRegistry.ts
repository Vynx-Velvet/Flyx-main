/**
 * Central provider registry for Flyx 3.0.
 *
 * Manages all content providers and provides lookup/filtering
 * by content type with automatic fallback ordering.
 *
 * In Flyx 2.0, the registry used `require()` in ESM with 20
 * separate try/catch blocks. This version uses decorator-based
 * registration or manual `register()` calls.
 */

import type { ContentCategory, MediaType, ProviderConfig, ExtractionRequest, ExtractionResult, StreamSource } from "@flyx/core";

/**
 * Provider interface that all registered providers must satisfy.
 *
 * This mirrors the public API of {@link BaseProvider} so the
 * registry works with both class instances and plain objects.
 */
export interface Provider {
  readonly name: string;
  readonly priority: number;
  readonly enabled: boolean;
  readonly supportedContent: ContentCategory[];
  extract(request: ExtractionRequest): Promise<ExtractionResult>;
  fetchSourceByName(sourceName: string, request: ExtractionRequest): Promise<StreamSource | null>;
  supportsContent(mediaType: MediaType, metadata?: { isAnime?: boolean; isLive?: boolean; category?: ContentCategory }): boolean;
  getConfig(): ProviderConfig;
}

/**
 * Registry of all content providers.
 *
 * @example
 * ```ts
 * const registry = new ProviderRegistry();
 * registry.register(new FlixerProvider());
 *
 * // Get providers for a movie, ordered by priority
 * const providers = registry.getForContent("movie");
 * ```
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, Provider>();

  /**
   * Register a provider.
   *
   * @param provider - The provider instance to register.
   * @throws If a provider with the same name is already registered.
   */
  register(provider: Provider): void {
    if (this.providers.has(provider.name)) {
      throw new Error(`Provider "${provider.name}" is already registered`);
    }
    this.providers.set(provider.name, provider);
  }

  /**
   * Get a provider by name.
   *
   * @param name - The provider name.
   * @returns The provider, or `undefined` if not found.
   */
  get(name: string): Provider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get all enabled providers that support a given content type,
   * sorted by priority (lowest first = tried first).
   *
   * @param mediaType - "movie" or "tv".
   * @param metadata - Optional anime/live flags.
   * @returns Priority-sorted array of matching providers.
   */
  getForContent(
    mediaType: MediaType,
    metadata?: { isAnime?: boolean; isLive?: boolean; category?: ContentCategory },
  ): Provider[] {
    const matching: Provider[] = [];

    for (const provider of this.providers.values()) {
      if (!provider.enabled) continue;
      if (provider.supportsContent(mediaType, metadata)) {
        matching.push(provider);
      }
    }

    return matching.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get all enabled providers.
   */
  getAllEnabled(): Provider[] {
    const enabled: Provider[] = [];
    for (const provider of this.providers.values()) {
      if (provider.enabled) {
        enabled.push(provider);
      }
    }
    return enabled.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get all registered providers (including disabled).
   */
  getAll(): Provider[] {
    return [...this.providers.values()].sort((a, b) => a.priority - b.priority);
  }

  /**
   * Serialise all provider configurations for the API.
   */
  serializeConfigs(): ProviderConfig[] {
    return this.getAll().map((p) => p.getConfig());
  }

  /**
   * Number of registered providers.
   */
  get size(): number {
    return this.providers.size;
  }

  /**
   * Provider names, sorted by priority.
   */
  get names(): string[] {
    return [...this.providers.values()]
      .sort((a, b) => a.priority - b.priority)
      .map((p) => p.name);
  }
}

/**
 * Singleton registry instance for the application.
 */
export const providerRegistry = new ProviderRegistry();
