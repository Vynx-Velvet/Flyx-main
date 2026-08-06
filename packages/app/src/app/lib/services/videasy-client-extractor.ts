// Videasy client-side extractor — resolves stream sources from Videasy
export async function extractVideasyClient(
  contentId: string,
  mediaType: 'movie' | 'tv',
  title: string,
  season?: number,
  episode?: number,
): Promise<Array<{ title: string; url: string; quality?: string; skipIntro?: [number, number]; skipOutro?: [number, number] }>> {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const params = new URLSearchParams({ tmdbId: contentId, type: mediaType });
    if (title) params.set('title', title);
    if (season != null) params.set('season', String(season));
    if (episode != null) params.set('episode', String(episode));

    const res = await fetch(`${base}/api/stream/extract?provider=videasy&${params}`);
    const data = await res.json();
    if (data.success && data.sources?.length) return data.sources;
    return [];
  } catch {
    return [];
  }
}
