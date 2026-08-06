/**
 * @flyx/core
 *
 * Core shared package for Flyx 3.0.
 *
 * Provides:
 * - **Types** — Single source of truth for all shared type definitions
 * - **Errors** — Unified error hierarchy (replaces 5+ fragmented systems)
 * - **Cache** — Unified cache with TTL and stale-while-revalidate
 * - **Utils** — Stream proxy, M3U8 rewriting, retry, debounce
 */

// Types
export type {
  // Provider
  ContentCategory,
  MediaType,
  StreamSource,
  SubtitleTrack,
  ExtractionRequest,
  ExtractionResult,
  ProviderConfig,
  ProviderPriorityMap,
  // Media
  VideoData,
  ContentQuery,
  PaginatedResponse,
  // Manga
  MangaStatus,
  MangaContentRating,
  MangaCard,
  MangaData,
  ChapterData,
  MangaPageData,
  MangaReadingProgress,
  // API
  APIErrorResponse,
  APISuccessResponse,
  APIResponse,
  RetryConfig,
  FetchWithTimeoutOptions,
  // Sync
  SyncData,
  SyncWatchlistEntry,
  SyncWatchProgressEntry,
  SyncContinueWatchingEntry,
  SyncPreferences,
  SyncCode,
  SyncOperation,
  SyncRequest,
  SyncResponse,
} from "./types";

export { CACHE_DURATIONS, ErrorCode } from "./types";
export type { ErrorCodeType, ErrorCategory } from "./types";

// Errors
export {
  FlyxError,
  ProviderError,
  AllProvidersFailedError,
  ProviderNotFoundError,
  ProviderDisabledError,
  NetworkError,
  TimeoutError,
  RateLimitedError,
  CloudflareBlockedError,
  ExtractionError,
  ExtractionAbortedError,
  DecoderFailedError,
  NoSourcesFoundError,
  M3U8ParseError,
  ValidationError,
  InvalidMediaTypeError,
  MissingParameterError,
} from "./errors";

// Utils
export {
  UnifiedCache,
  cache,
  fetchWithRetry,
  retryWithBackoff,
  DEFAULT_RETRY_CONFIG,
  StreamProxy,
  rewriteM3U8,
  proxySegmentUrl,
  debounce,
  throttle,
} from "./utils";

export type { CacheConfig, CacheStorageAdapter, ProxyConfig, M3U8RewriteConfig } from "./utils";
