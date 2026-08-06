/**
 * Zod Validation Schemas for Content API
 * Ported from Flyx 2.0 — adapted for Flyx 3.0 monorepo.
 */

import { z } from 'zod';

/**
 * Trending content query parameters
 */
export const trendingQuerySchema = z.object({
  mediaType: z.enum(['movie', 'tv', 'all']).optional().default('all'),
  timeWindow: z.enum(['day', 'week']).optional().default('week'),
});

export type TrendingQuery = z.infer<typeof trendingQuerySchema>;

/**
 * Search query parameters
 */
export const searchQuerySchema = z.object({
  query: z.string().min(1, 'Search query is required').max(100, 'Query too long'),
  page: z.coerce.number().int().min(1).max(100).optional().default(1),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

/**
 * Content details query parameters
 */
export const detailsQuerySchema = z.object({
  id: z.string().min(1, 'Content ID is required'),
  mediaType: z.enum(['movie', 'tv']),
});

export type DetailsQuery = z.infer<typeof detailsQuerySchema>;

/**
 * Validate query parameters from URL
 */
export function validateQuery<T>(
  schema: z.ZodSchema<T>,
  searchParams: URLSearchParams,
): { success: true; data: T } | { success: false; error: string } {
  try {
    const params: Record<string, unknown> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });

    const result = schema.safeParse(params);

    if (!result.success) {
      const errors = result.error.issues
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return { success: false, error: errors };
    }

    return { success: true, data: result.data };
  } catch {
    return { success: false, error: 'Invalid query parameters' };
  }
}
