/**
 * Superembed Extractor
 * Extracts M3U8 streams from Superembed sources
 */

import https from 'https';
import { Buffer } from 'buffer';

interface SuperembedResult {
  url: string;
  quality: string;
  headers?: Record<string, string>;
}

/**
 * Extract stream from Superembed
 */
export async function extractSuperembed(
  tmdbId: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<SuperembedResult[]> {
  try {
    // Superembed embed URL
    const embedUrl = type === 'movie'
      ? `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`
      : `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}`;
    
    // Fetch the embed page
    const embedPage = await fetchPage(embedUrl);
    
    // Extract the player source URL
    const sourceMatch = embedPage.match(/sources:\s*\[\s*{\s*file:\s*["']([^"']+)["']/);
    if (!sourceMatch) {
      throw new Error('No source found in Superembed page');
    }
    
    let sourceUrl = sourceMatch[1];
    
    // Decode if base64
    if (sourceUrl.startsWith('data:')) {
      const base64Match = sourceUrl.match(/base64,([^"']+)/);
      if (base64Match) {
        sourceUrl = Buffer.from(base64Match[1], 'base64').toString('utf-8');
      }
    }
    
    // Resolve relative URLs
    if (sourceUrl.startsWith('//')) {
      sourceUrl = 'https:' + sourceUrl;
    } else if (sourceUrl.startsWith('/')) {
      sourceUrl = 'https://multiembed.mov' + sourceUrl;
    }
    
    return [{
      url: sourceUrl,
      quality: 'auto',
      headers: {
        'Referer': 'https://multiembed.mov/',
        'Origin': 'https://multiembed.mov'
      }
    }];
  } catch (error) {
    console.error('Superembed extraction error:', error);
    throw error;
  }
}

/**
 * Fetch a page with proper headers
 */
function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://multiembed.mov/'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}
