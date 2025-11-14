/**
 * Cloudstream Extractor
 * Extracts M3U8 streams from Cloudstream sources
 */

import https from 'https';

interface CloudstreamResult {
  url: string;
  quality: string;
  headers?: Record<string, string>;
}

/**
 * Extract stream from Cloudstream
 */
export async function extractCloudstream(
  tmdbId: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<CloudstreamResult[]> {
  try {
    // Cloudstream API endpoint
    const baseUrl = 'https://api.cloudstream.to';
    const path = type === 'movie' 
      ? `/api/v1/movie/${tmdbId}`
      : `/api/v1/tv/${tmdbId}/${season}/${episode}`;
    
    const response = await fetchCloudstream(baseUrl + path);
    const data = JSON.parse(response);
    
    if (!data.sources || !Array.isArray(data.sources)) {
      throw new Error('No sources found in Cloudstream response');
    }
    
    // Extract M3U8 URLs
    const results: CloudstreamResult[] = [];
    
    for (const source of data.sources) {
      if (source.url && source.url.includes('.m3u8')) {
        results.push({
          url: source.url,
          quality: source.quality || 'auto',
          headers: {
            'Referer': 'https://cloudstream.to/',
            'Origin': 'https://cloudstream.to'
          }
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Cloudstream extraction error:', error);
    throw error;
  }
}

/**
 * Fetch from Cloudstream API
 */
function fetchCloudstream(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://cloudstream.to/'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}
