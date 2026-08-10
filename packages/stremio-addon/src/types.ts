export interface Env {
  /** TMDB v3 API key used to translate Stremio IMDb IDs to TMDB IDs. */
  TMDB_API_KEY?: string;
  /** High-entropy token used as the private URL prefix for every add-on route. */
  ADDON_TOKEN?: string;
}

export type StremioContentType = "movie" | "series";

export interface ParsedStremioId {
  imdbId: string;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
}

export interface StremioStream {
  name: string;
  title: string;
  url: string;
}

export interface StremioStreamResponse {
  streams: StremioStream[];
}
