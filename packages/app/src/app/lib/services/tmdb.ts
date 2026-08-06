const TMDB_BASE = 'https://api.themoviedb.org/3';
export async function fetchTMDBData(endpoint, params = {}) {
  const url = new URL(TMDB_BASE + endpoint);
  const key = process.env.TMDB_API_KEY || '';
  if (!key.startsWith('eyJ')) url.searchParams.set('api_key', key);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set('language', 'en-US');
  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' }, next: { revalidate: 300 } });
  if (!res.ok) return null;
  return res.json();
}
