/**
 * 2Embed Extractor
 * Extracts M3U8 streams from 2Embed sources
 */

import https from 'https';
import { Buffer } from 'buffer';

interface TwoEmbedResult {
  url: string;
  quality: string;
  headers?: Record<string, string>;
}

/**
 * Extract stream from 2Embed
 */
export async function extract2Embed(
  tmdbId: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<TwoEmbedResult[]> {
  try {
    // 2Embed embed URL
    const embedUrl = type === 'movie'
      ? `https://www.2embed.cc/embed/${tmdbId}`
      : `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`;
    
    // Fetch the embed page
    const embedPage = await fetchPage(embedUrl);
    
    // Extract iframe source
    const iframeMatch = embedPage.match(/iframe[^>]+src=["']([^"']+)["']/i);
    if (!iframeMatch) {
      throw new Error('No iframe found in 2Embed page');
    }
    
    let iframeUrl = iframeMatch[1];
    if (iframeUrl.startsWith('//')) {
      iframeUrl = 'https:' + iframeUrl;
    } else if (iframeUrl.startsWith('/')) {
      iframeUrl = 'https://www.2embed.cc' + iframeUrl;
    }
    
    // Fetch the iframe page
    const iframePage = await fetchPage(iframeUrl);
    
    // Extract M3U8 URL from various patterns
    const patterns = [
      /file:\s*["']([^"']+\.m3u8[^"']*)["']/i,
      /source:\s*["']([^"']+\.m3u8[^"']*)["']/i,
      /src:\s*["']([^"']+\.m3u8[^"']*)["']/i,
      /"file":\s*["']([^"']+\.m3u8[^"']*)["']/i,
      /sources:\s*\[\s*["']([^"']+\.m3u8[^"']*)["']/i
    ];
    
    let m3u8Url: string | null = null;
    
    for (const pattern of patterns) {
      const match = iframePage.match(pattern);
      if (match) {
        m3u8Url = match[1];
        break;
      }
    }
    
    if (!m3u8Url) {
      // Try to find base64 encoded data
      const base64Match = iframePage.match(/atob\(["']([^"']+)["']\)/);
      if (base64Match) {
        const decoded = Buffer.from(base64Match[1], 'base64').toString('utf-8');
        const urlMatch = decoded.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);
        if (urlMatch) {
          m3u8Url = urlMatch[0];
        }
      }
    }
    
    if (!m3u8Url) {
      throw new Error('No M3U8 URL found in 2Embed iframe');
    }
    
    // Resolve relative URLs
    if (m3u8Url.startsWith('//')) {
      m3u8Url = 'https:' + m3u8Url;
    } else if (m3u8Url.startsWith('/')) {
      const iframeOrigin = new URL(iframeUrl).origin;
      m3u8Url = iframeOrigin + m3u8Url;
    }
    
    return [{
      url: m3u8Url,
      quality: 'auto',
      headers: {
        'Referer': iframeUrl,
        'Origin': new URL(iframeUrl).origin
      }
    }];
  } catch (error) {
    console.error('2Embed extraction error:', error);
    throw error;
  }
}

/**
 * Fetch a page with proper headers
 */
function fetchPage(url: string, referer?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': referer || 'https://www.2embed.cc/'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}
