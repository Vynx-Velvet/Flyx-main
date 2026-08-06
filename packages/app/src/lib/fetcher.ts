/**
 * Data fetching utilities for client components.
 *
 * Provides:
 * - `fetcher` — A generic fetch wrapper for SWR / useSWR to consume.
 * - `tmdbFetch` — Calls our `/api/tmdb` proxy (handles auth/image injection).
 * - `apiFetch` — Calls any internal API route and unwraps the response.
 *
 * Ported from Flyx 2.0 patterns — adapted for Flyx 3.0 monorepo.
 */

import { apiClient } from './api-client';

// ---------------------------------------------------------------------------
// Generic fetcher for SWR / react-query
// ---------------------------------------------------------------------------

export interface FetcherOptions extends RequestInit {
  /** Base URL override (defaults to same origin). */
  baseUrl?: string;
  /** Timeout in milliseconds. */
  timeout?: number;
}

/**
 * Generic fetcher that can be used with SWR / useSWR.
 *
 * @example
 * ```ts
 * const { data } = useSWR('/api/tmdb?path=/trending/movie/week', fetcher);
 * ```
 */
export async function fetcher<T = unknown>(
  url: string,
  options: FetcherOptions = {},
): Promise<T> {
  const { baseUrl, timeout = 10000, ...fetchOptions } = options;
  const fullUrl = url.startsWith('http') ? url : `${baseUrl ?? ''}${url}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(fullUrl, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...fetchOptions.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new FetcherError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        body,
      );
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Error class for fetcher failures.
 */
export class FetcherError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string,
  ) {
    super(message);
    this.name = 'FetcherError';
  }
}

// ---------------------------------------------------------------------------
// TMDB-specific fetch helper (calls our /api/tmdb proxy)
// ---------------------------------------------------------------------------

/**
 * Fetch from TMDB via our internal proxy endpoint.
 *
 * @param path - TMDB API path (e.g. `/trending/movie/week`)
 * @param options - Additional fetch options.
 * @returns Parsed TMDB response.
 */
export async function tmdbFetch<T = unknown>(
  path: string,
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  const url = `/api/tmdb?path=${encodeURIComponent(path)}`;
  return fetcher<T>(url, { signal: options.signal });
}

// ---------------------------------------------------------------------------
// Internal API fetch helper (calls any /api/* route)
// ---------------------------------------------------------------------------

/**
 * Fetch from an internal API endpoint with response unwrapping.
 *
 * Handles both `{ success: true, data: T }` and `{ error, message }` response
 * formats used by Flyx API routes.
 *
 * @example
 * ```ts
 * const movies = await apiFetch<Movie[]>('/api/content/trending?mediaType=movie');
 * ```
 */
export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const data = await fetcher<unknown>(endpoint, options);

  // Unwrap success envelope
  if (
    data &&
    typeof data === 'object' &&
    'success' in data &&
    (data as Record<string, unknown>).success === true &&
    'data' in data
  ) {
    return (data as { data: T }).data;
  }

  // Unwrap error envelope
  if (
    data &&
    typeof data === 'object' &&
    'error' in data &&
    'message' in data
  ) {
    throw new FetcherError(
      (data as { message: string }).message,
      0,
      JSON.stringify(data),
    );
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// Legacy API client wrapper
// ---------------------------------------------------------------------------

/**
 * Use the enhanced API client for requests requiring retry logic, offline
 * detection, and SWR caching.
 */
export { apiClient };
