/**
 * Anime client-side extractor — resolves stream sources from AnimeX.
 *
 * Delegates to the unified /api/anime/stream endpoint which uses the
 * ExtractionPipeline with AnimeX provider.
 */
export async function extractAnimeClient(
  malId: number,
  title: string,
  episode?: number,
): Promise<{
  sources: Array<{ title: string; url: string; quality?: string; skipIntro?: [number, number]; skipOutro?: [number, number] }>;
  error?: string;
}> {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const params = new URLSearchParams({ malId: String(malId) });
    if (title) params.set("title", title);
    if (episode != null) params.set("episode", String(episode));

    const res = await fetch(`${base}/api/anime/stream?${params}`);
    const data = await res.json();

    if (data.success && data.sources?.length) {
      return { sources: data.sources };
    }

    // Return the error from the API so the UI can show it
    return {
      sources: [],
      error: data.error || `No sources found${data.provider ? ` via ${data.provider}` : ""}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    return { sources: [], error: `Failed to fetch stream: ${msg}` };
  }
}
