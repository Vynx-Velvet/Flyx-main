/**
 * Core provider types for Flyx 3.0.
 *
 * These types define the contract between the provider registry,
 * extraction pipeline, and stream consumers. This is the **single
 * source of truth** — no other package defines its own duplicate
 * StreamSource or ExtractionResult types.
 *
 * @module provider
 */

/** Supported content categories a provider can handle. */
export type ContentCategory =
  | "movie"
  | "tv"
  | "anime"
  | "manga"
  | "live-tv"
  | "live-sports"
  | "ppv"
  | "iptv";

/** Media type for routing providers to the right content. */
export type MediaType = "movie" | "tv";

/** A stream source returned by a provider. */
export interface StreamSource {
  /** Direct or proxied stream URL (HLS .m3u8 or MPEG-DASH .mpd). */
  url: string;
  /** Display quality label (e.g. "1080p", "4K", "Auto"). */
  quality: string;
  /** MIME type (e.g. "application/x-mpegURL", "application/dash+xml"). */
  type: "hls" | "dash" | "mp4";
  /** Display title for the source (e.g. "Server 1", "VidCloud"). */
  title?: string;
  /** Language for dubbed/subtitled streams. */
  language?: string;
  /** Whether segments need proxying through the stream proxy. */
  requiresSegmentProxy?: boolean;
  /** URL to fetch IP-bound tokens from (e.g. VidSrc gen_token_url). */
  tokenUrl?: string;
  /** Referer header required by the CDN. */
  referer?: string;
  /** Origin header required by the CDN. */
  origin?: string;
  /** User-agent override for this source. */
  userAgent?: string;
  /** HTTP status of the source URL when last checked. */
  status?: number;
  /** Intro skip start time in seconds. */
  skipIntro?: { start: number; end: number };
  /** Outro skip start time in seconds. */
  skipOutro?: { start: number; end: number };
  /** Whether this source is HEVC encoded. */
  isHevc?: boolean;
}

/** A subtitle track associated with a stream. */
export interface SubtitleTrack {
  /** Display label (e.g. "English", "Spanish [CC]"). */
  label: string;
  /** URL to the subtitle file (.vtt or .srt). */
  url: string;
  /** ISO 639-1 language code. */
  language: string;
  /** Whether these are closed captions (hearing impaired). */
  isCC?: boolean;
}

/** Parameters for requesting stream extraction from a provider. */
export interface ExtractionRequest {
  /** TMDB ID for movies and TV shows. */
  tmdbId: number;
  /** Content media type. */
  mediaType: MediaType;
  /** Season number (TV only). */
  season?: number;
  /** Episode number (TV only). */
  episode?: number;
  /** MyAnimeList ID (anime only). */
  malId?: number;
  /** Title for provider-specific lookups. */
  title?: string;
  /** Japanese/romaji title for anime providers. */
  malTitle?: string;
  /** CAPTCHA token for providers that require human verification. */
  capToken?: string;
}

/** Result of a provider extraction attempt. */
export interface ExtractionResult {
  /** Whether extraction succeeded and sources were found. */
  success: boolean;
  /** Available stream sources (empty on failure). */
  sources: StreamSource[];
  /** Available subtitle tracks (empty if none). */
  subtitles: SubtitleTrack[];
  /** The provider that generated this result. */
  provider: string;
  /** Error message if extraction failed. */
  error?: string;
  /** Extraction duration in milliseconds. */
  timing?: number;
  /** Raw hex data (for client-side decryption). */
  hexData?: string;
  /** Whether the client needs to decrypt the data. */
  needsClientDecrypt?: boolean;
}

/** Serialisable provider configuration for the API and settings UI. */
export interface ProviderConfig {
  /** Unique provider identifier. */
  name: string;
  /** Priority (lower = tried first). */
  priority: number;
  /** Whether the provider is currently enabled. */
  enabled: boolean;
  /** Content categories this provider handles. */
  supportedContent: ContentCategory[];
}

/** Priority-ordered mapping of provider names to their priorities. */
export type ProviderPriorityMap = Record<string, number>;
