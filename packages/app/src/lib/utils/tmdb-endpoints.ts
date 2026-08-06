export const TMDB_ENDPOINTS = {
  trending: (type, window) => '/trending/' + type + '/' + window,
  popular: (type) => '/' + type + '/popular',
  topRated: (type) => '/' + type + '/top_rated',
  search: '/search/multi',
  details: (type, id) => '/' + type + '/' + id,
  recommendations: (type, id) => '/' + type + '/' + id + '/recommendations',
} as const;
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
