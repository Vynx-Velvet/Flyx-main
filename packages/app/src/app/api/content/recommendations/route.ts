/**
 * Content Recommendations API Route
 * GET /api/content/recommendations?id=123&type=movie
 * Returns recommended or similar content from TMDB.
 *
 * Ported from Flyx 2.0 — adapted for Flyx 3.0 monorepo.
 * - Uses NEXT_PUBLIC_TMDB_API_KEY or process.env.TMDB_API_KEY.
 * - Falls back to similar content if recommendations are empty.
 */

import { NextRequest, NextResponse } from 'next/server';

const TMDB_BASE = 'https://api.themoviedb.org/3';

function getApiKey(): string {
  return (
    process.env.NEXT_PUBLIC_TMDB_API_KEY || process.env.TMDB_API_KEY || ''
  );
}

function buildUrl(path: string): string {
  const url = new URL(`${TMDB_BASE}${path}`);
  const apiKey = getApiKey();

  if (apiKey.startsWith('eyJ')) {
    // JWT token — will be passed as Bearer header
    return url.toString();
  }

  url.searchParams.set('api_key', apiKey);
  return url.toString();
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const apiKey = getApiKey();
  if (apiKey.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const type = searchParams.get('type') || 'movie';

  if (!id) {
    return NextResponse.json(
      { error: 'Missing id parameter' },
      { status: 400 },
    );
  }

  if (!getApiKey()) {
    return NextResponse.json(
      { error: 'TMDB API key not configured' },
      { status: 500 },
    );
  }

  try {
    // Fetch recommendations from TMDB
    const response = await fetch(
      buildUrl(`/${type}/${id}/recommendations`),
      {
        headers: buildHeaders(),
        next: { revalidate: 3600 },
      },
    );

    if (!response.ok) {
      // If recommendations fail, try similar content
      const similarResponse = await fetch(
        buildUrl(`/${type}/${id}/similar`),
        {
          headers: buildHeaders(),
          next: { revalidate: 3600 },
        },
      );

      if (!similarResponse.ok) {
        return NextResponse.json({ results: [] });
      }

      const similarData = await similarResponse.json();
      const results = (similarData.results || []).map((item: any) => ({
        ...item,
        mediaType: type,
        media_type: type,
      }));

      return NextResponse.json({ results });
    }

    const data = await response.json();
    const results = (data.results || []).map((item: any) => ({
      ...item,
      mediaType: type,
      media_type: type,
    }));

    // Also fetch similar for richer "More like this" clients
    let similar: any[] = [];
    try {
      const similarResponse = await fetch(buildUrl(`/${type}/${id}/similar`), {
        headers: buildHeaders(),
        next: { revalidate: 3600 },
      });
      if (similarResponse.ok) {
        const similarData = await similarResponse.json();
        similar = (similarData.results || []).map((item: any) => ({
          ...item,
          mediaType: type,
          media_type: type,
        }));
      }
    } catch {
      /* optional */
    }

    return NextResponse.json({ results, similar, recommended: results });
  } catch (error) {
    console.error('[Recommendations API] Error:', error);
    return NextResponse.json({ results: [], similar: [], recommended: [] });
  }
}
