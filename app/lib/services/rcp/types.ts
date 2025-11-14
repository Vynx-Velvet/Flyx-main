/**
 * Core TypeScript interfaces for RCP extraction system
 */

export type ProviderName = '2embed' | 'superembed' | 'cloudstream';
export type ContentType = 'movie' | 'tv';

/**
 * Request parameters for stream extraction
 */
export interface ExtractionRequest {
  tmdbId: string;
  type: ContentType;
  season?: number;
  episode?: number;
  providers?: ProviderName[];
  timeout?: number;
}

/**
 * Parameters passed to individual provider extractors
 */
export interface ExtractionParams {
  tmdbId: string;
  type: ContentType;
  season?: number;
  episode?: number;
}

/**
 * Result from a successful extraction
 */
export interface ExtractionResult {
  success: boolean;
  m3u8Url?: string;
  provider?: ProviderName;
  duration: number;
  attempts: ProviderAttempt[];
  requestId: string;
}

/**
 * Details about a single provider extraction attempt
 */
export interface ProviderAttempt {
  provider: ProviderName;
  success: boolean;
  duration: number;
  error?: string;
  steps: StepResult[];
}

/**
 * Result from a single extraction step
 */
export interface StepResult {
  step: string;
  success: boolean;
  duration: number;
  error?: string;
  data?: any;
}

/**
 * Error information for failed extractions
 */
export interface ExtractionError {
  code: string;
  message: string;
  provider?: ProviderName;
  step?: string;
  details?: any;
  requestId: string;
}

/**
 * Configuration for a provider
 */
export interface ProviderConfig {
  name: ProviderName;
  enabled: boolean;
  priority: number;
  timeout: number;
  retries: number;
  hashPatterns: RegExp[];
  proRcpPatterns: RegExp[];
  m3u8Patterns: RegExp[];
}

/**
 * Hidden div data extracted from ProRCP pages
 */
export interface HiddenDivData {
  divId: string;
  encoded: string;
}

/**
 * Result from decoding operation
 */
export interface DecoderResult {
  url: string;
  method: string;
  urls: string[];
}

/**
 * Decoder function interface
 */
export interface Decoder {
  name: string;
  fn: (encoded: string, divId: string) => string | null;
}

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  requestId: string;
  provider?: ProviderName;
  step?: string;
  message: string;
  data?: any;
  duration?: number;
}

/**
 * Error codes for extraction failures
 */
export const ERROR_CODES = {
  HASH_NOT_FOUND: 'HASH_NOT_FOUND',
  RCP_FETCH_FAILED: 'RCP_FETCH_FAILED',
  PRORCP_NOT_FOUND: 'PRORCP_NOT_FOUND',
  PRORCP_FETCH_FAILED: 'PRORCP_FETCH_FAILED',
  M3U8_NOT_FOUND: 'M3U8_NOT_FOUND',
  M3U8_INVALID: 'M3U8_INVALID',
  TIMEOUT: 'TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  ALL_PROVIDERS_FAILED: 'ALL_PROVIDERS_FAILED',
  HIDDEN_DIV_NOT_FOUND: 'HIDDEN_DIV_NOT_FOUND',
  DECODE_FAILED: 'DECODE_FAILED',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
