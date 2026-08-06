export interface Genre {
  id: number;
  name: string;
}

export interface MediaItem {
  id: number | string;
  title?: string;
  name?: string;
  overview?: string;
  posterPath?: string;
  poster_path?: string;
  backdropPath?: string;
  mediaType: 'movie' | 'tv';
  rating?: number;
  vote_average?: number;
  vote_count?: number;
  releaseDate?: string;
  release_date?: string;
  first_air_date?: string;
  genres?: Genre[];
  genre_ids?: number[];
  runtime?: number;
  popularity?: number;
}
