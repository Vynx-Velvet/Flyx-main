export const TMDB_ENDPOINTS = {
  trending: (type: string, window: string) => '/trending/' + type + '/' + window,
  popular: (type: string) => '/' + type + '/popular',
  topRated: (type: string) => '/' + type + '/top_rated',
  search: '/search/multi',
  details: (type: string, id: number) => '/' + type + '/' + id,
  recommendations: (type: string, id: number) => '/' + type + '/' + id + '/recommendations',
} as const;
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
