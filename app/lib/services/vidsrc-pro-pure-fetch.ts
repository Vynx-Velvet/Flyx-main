/**
 * VidSrc Pro - Pure Fetch Extractor
 * No VM, no Puppeteer - just HTTP requests and Caesar cipher decoding
 */

import * as https from 'https';

interface FetchOptions {
  referer?: string;
  headers?: Record<string, string>;
}

async function fetchPage(url: string, options: FetchOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Referer: options.referer || '',
          ...options.headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          } else {
            resolve(data);
          }
        });
      }
    ).on('error', reject);
  });
}

function caesarDecode(str: string, shift: number): string {
  return str
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);

      // Lowercase letters only
      if (code >= 97 && code <= 122) {
        return String.fromCharCode(((code - 97 + shift + 26) % 26) + 97);
      }
      // Uppercase letters only
      if (code >= 65 && code <= 90) {
        return String.fromCharCode(((code - 65 + shift + 26) % 26) + 65);
      }

      // Leave everything else unchanged (numbers, special chars, etc.)
      return char;
    })
    .join('');
}

function resolvePlaceholders(url: string): string {
  // Replace placeholders with shadowlandschronicles.com
  return url
    .replace(/\{v1\}/g, 'shadowlandschronicles.com')
    .replace(/\{v2\}/g, 'shadowlandschronicles.com')
    .replace(/\{v3\}/g, 'shadowlandschronicles.com')
    .replace(/\{v4\}/g, 'shadowlandschronicles.com')
    .replace(/\{s1\}/g, 'shadowlandschronicles.com');
}

export async function extractVidsrcPro(
  tmdbId: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Step 1: Get data hash from embed page
    const embedUrl = `https://vidsrc-embed.ru/embed/${type}/${tmdbId}${
      type === 'tv' ? `/${season}/${episode}` : ''
    }`;

    const embedHtml = await fetchPage(embedUrl);
    const dataHashMatch = embedHtml.match(/data-hash="([^"]+)"/);

    if (!dataHashMatch) {
      return { success: false, error: 'Data hash not found in embed page' };
    }

    const dataHash = dataHashMatch[1];

    // Step 2: Get ProRCP URL from RCP endpoint
    const rcpUrl = `https://cloudnestra.com/rcp/${dataHash}`;
    const rcpHtml = await fetchPage(rcpUrl, {
      referer: 'https://vidsrc-embed.ru/',
    });

    const iframeSrcMatch = rcpHtml.match(/src:\s*['"]([^'"]+)['"]/);
    if (!iframeSrcMatch) {
      return { success: false, error: 'ProRCP iframe not found' };
    }

    const proRcpUrl = `https://cloudnestra.com${iframeSrcMatch[1]}`;

    // Step 3: Get ProRCP page and extract encoded URL from div
    const proRcpHtml = await fetchPage(proRcpUrl, {
      referer: 'https://vidsrc-embed.ru/',
    });

    // Find div with encoded URL using multiple regex patterns
    let encodedUrl: string | null = null;

    // Pattern 1: Simple div with direct content
    const divRegex1 = /<div[^>]+id="[^"]+"[^>]*>([^<]+)<\/div>/g;
    let match;

    while ((match = divRegex1.exec(proRcpHtml)) !== null) {
      const content = match[1].trim();
      if (content.length > 100 && content.includes('://')) {
        encodedUrl = content;
        break;
      }
    }

    // Pattern 2: Div with potential whitespace/newlines
    if (!encodedUrl) {
      const divRegex2 = /<div[^>]+id="[^"]+"[^>]*>[\s\S]*?([a-z]+:\/\/[^\s<]+)[\s\S]*?<\/div>/g;
      while ((match = divRegex2.exec(proRcpHtml)) !== null) {
        const content = match[1].trim();
        if (content.length > 100) {
          encodedUrl = content;
          break;
        }
      }
    }

    if (!encodedUrl) {
      return { success: false, error: 'Encoded URL not found in ProRCP page' };
    }

    // Step 4: Decode with Caesar cipher (shift +3 for letters only)
    // eqqmp:// -> https://
    const decoded = caesarDecode(encodedUrl, 3);

    if (!decoded.startsWith('https://') && !decoded.startsWith('http://')) {
      return { success: false, error: 'Decoded URL is invalid' };
    }

    // Step 5: Resolve placeholders
    const finalUrl = resolvePlaceholders(decoded);

    // Extract the first URL if there are multiple (separated by " or ")
    const firstUrl = finalUrl.split(' or ')[0];

    return {
      success: true,
      url: firstUrl,
    };
  } catch (error) {
    console.error('VidSrc Pro extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
