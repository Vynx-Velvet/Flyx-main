/**
 * @flyx/core/types
 *
 * Single source of truth for all shared type definitions across Flyx 3.0.
 * No other package should define its own StreamSource, ExtractionResult,
 * or other types defined here.
 */

export type {
  ContentCategory,
  MediaType,
  StreamSource,
  SubtitleTrack,
  ExtractionRequest,
  ExtractionResult,
  ProviderConfig,
  ProviderPriorityMap,
} from "./provider";

export type {
  VideoData,
  ContentQuery,
  PaginatedResponse,
} from "./media";

export type {
  APIErrorResponse,
  APISuccessResponse,
  APIResponse,
  RetryConfig,
  FetchWithTimeoutOptions,
} from "./api";

export { CACHE_DURATIONS } from "./api";

export { ErrorCode } from "./error";

export type { ErrorCodeType, ErrorCategory } from "./error";

export type {
  SyncData,
  SyncWatchlistEntry,
  SyncWatchProgressEntry,
  SyncContinueWatchingEntry,
  SyncPreferences,
  SyncCode,
  SyncOperation,
  SyncRequest,
  SyncResponse,
} from "./sync";

export type {
  MangaStatus,
  MangaContentRating,
  MangaCard,
  MangaData,
  ChapterData,
  MangaPageData,
  MangaReadingProgress,
} from "./manga";
