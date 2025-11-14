/**
 * VIDSRC M3U8 EXTRACTOR
 * 
 * Pure fetch-based extraction with all observed decryption methods
 * Lean, efficient, production-ready
 */

import https from 'https';

interface ExtractionResult {
  success: boolean;
  url?: string;
  method?: string;
  error?: string;
}

interface ContentRequest {
  tmdbId: number;
  type: 'movie' | 'tv';
  season?: number;
  episode?: number;
}

/**
 * Extract M3U8 URL from VidSrc
 */
export async function extractM3U8(request: ContentRequest): Promise<ExtractionResult> {
  const { tmdbId, type, season, episode } = request;
  
  try {
    // Build embed URL
    let embedUrl = `https://vidsrc-embed.ru/embed/${type}/${tmdbId}`;
    if (type === 'tv' && season && episode) {
      embedUrl += `/${season}/${episode}`;
    }
    
    // Step 1: Get embed page and extract hash
    const embedPage = await fetchPage(embedUrl);
    const hash = extractHash(embedPage);
    if (!hash) {
      return { success: false, error: 'No hash found in embed page' };
    }
    
    // Step 2: Get RCP page and extract prorcp
    const rcpUrl = `https://cloudnestra.com/rcp/${hash}`;
    const rcpPage = await fetchPage(rcpUrl, embedUrl);
    const prorcp = extractProrcp(rcpPage);
    if (!prorcp) {
      return { success: false, error: 'No prorcp found in RCP page' };
    }
    
    // Step 3: Get player page and extract hidden div
    const playerUrl = `https://cloudnestra.com/prorcp/${prorcp}`;
    const playerPage = await fetchPage(playerUrl, rcpUrl);
    const hiddenDiv = extractHiddenDiv(playerPage);
    if (!hiddenDiv) {
      return { success: false, error: 'No hidden div found in player page' };
    }
    
    // Step 4: Try all decryption methods
    const result = tryAllDecoders(hiddenDiv.encoded, hiddenDiv.divId);
    if (result) {
      return {
        success: true,
        url: result.url,
        urls: result.urls,
        method: result.method
      };
    }
    
    return { success: false, error: 'All decryption methods failed' };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Fetch a page with proper headers
 */
function fetchPage(url: string, referer: string = 'https://vidsrc-embed.ru/'): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': referer,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * Extract hash from embed page
 */
function extractHash(page: string): string | null {
  const match = page.match(/data-hash="([^"]+)"/);
  return match ? match[1] : null;
}

/**
 * Extract prorcp from RCP page
 */
function extractProrcp(page: string): string | null {
  const match = page.match(/\/prorcp\/([A-Za-z0-9+\/=\-_]+)/);
  return match ? match[1] : null;
}

/**
 * Extract hidden div from player page
 */
function extractHiddenDiv(page: string): { divId: string; encoded: string } | null {
  const match = page.match(/<div[^>]+id="([^"]+)"[^>]+style="display:none;">([^<]+)<\/div>/);
  return match ? { divId: match[1], encoded: match[2] } : null;
}

/**
 * Try all decryption methods and resolve placeholders
 */
function tryAllDecoders(encoded: string, divId: string): { url: string; method: string; urls: string[] } | null {
  for (const decoder of DECODERS) {
    try {
      const result = decoder.fn(encoded, divId);
      if (result && typeof result === 'string' && result.includes('http')) {
        // Resolve placeholders and generate all URL variants
        const urls = resolvePlaceholders(result);
        return { 
          url: urls[0], // Primary URL
          method: decoder.name,
          urls // All URL variants
        };
      }
    } catch {
      // Continue to next method
    }
  }
  return null;
}

/**
 * Resolve placeholder variables like {v1}, {v2}, {v3}, {v4}, {s1}, etc.
 * Returns array of all possible URLs
 */
function resolvePlaceholders(url: string): string[] {
  const urls: string[] = [];
  
  // CDN domain mappings (discovered through reverse engineering)
  // These placeholders provide CDN fallback options
  // Pattern: subdomain.{v1} → subdomain.shadowlandschronicles.com
  const cdnMappings: Record<string, string[]> = {
    '{v1}': ['shadowlandschronicles.com'],  // Primary CDN domain
    '{v2}': ['shadowlandschronicles.net'],  // Fallback CDN domain
    '{v3}': ['shadowlandschronicles.io'],   // Fallback CDN domain
    '{v4}': ['shadowlandschronicles.org'],  // Fallback CDN domain
  };
  
  // Find all placeholders in the URL
  const placeholders = url.match(/\{[^}]+\}/g) || [];
  
  if (placeholders.length === 0) {
    return [url];
  }
  
  // Generate URLs for each placeholder variant
  const firstPlaceholder = placeholders[0];
  const replacements = cdnMappings[firstPlaceholder] || [firstPlaceholder.slice(1, -1)];
  
  for (const replacement of replacements) {
    const newUrl = url.replace(firstPlaceholder, replacement);
    
    // Recursively resolve remaining placeholders
    const resolvedUrls = resolvePlaceholders(newUrl);
    urls.push(...resolvedUrls);
  }
  
  return urls;
}

/**
 * All observed decryption methods
 */
const DECODERS = [
  // Caesar ciphers (most common)
  {
    name: 'Caesar -3',
    fn: (data: string) => caesarShift(data, -3)
  },
  {
    name: 'Caesar +3',
    fn: (data: string) => caesarShift(data, 3)
  },
  ...Array.from({ length: 24 }, (_, i) => ({
    name: `Caesar ${i + 1}`,
    fn: (data: string) => caesarShift(data, i + 1)
  })),
  
  // Base64 variants
  {
    name: 'Base64',
    fn: (data: string) => Buffer.from(data, 'base64').toString('utf8')
  },
  {
    name: 'Base64 Reversed',
    fn: (data: string) => Buffer.from(data.split('').reverse().join(''), 'base64').toString('utf8')
  },
  
  // Hex variants
  {
    name: 'Hex',
    fn: (data: string) => Buffer.from(data, 'hex').toString('utf8')
  },
  {
    name: 'Hex (g=a)',
    fn: (data: string) => Buffer.from(data.replace(/g/g, 'a').replace(/:/g, ''), 'hex').toString('utf8')
  },
  
  // XOR variants
  {
    name: 'XOR with Div ID',
    fn: (data: string, divId: string) => xorDecode(data, divId)
  },
  {
    name: 'XOR with Div ID (Base64)',
    fn: (data: string, divId: string) => xorDecode(Buffer.from(data, 'base64').toString(), divId)
  },
  
  // Other methods
  {
    name: 'ROT13',
    fn: (data: string) => data.replace(/[a-zA-Z]/g, c => 
      String.fromCharCode((c <= 'Z' ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26)
    )
  },
  {
    name: 'Reverse',
    fn: (data: string) => data.split('').reverse().join('')
  },
  {
    name: 'No Encoding',
    fn: (data: string) => data
  }
];

/**
 * Caesar cipher shift
 */
function caesarShift(text: string, shift: number): string {
  return text.split('').map(c => {
    const code = c.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      return String.fromCharCode(((code - 65 + shift + 26) % 26) + 65);
    } else if (code >= 97 && code <= 122) {
      return String.fromCharCode(((code - 97 + shift + 26) % 26) + 97);
    }
    return c;
  }).join('');
}

/**
 * XOR decode with key
 */
function xorDecode(data: string, key: string): string {
  const buffer = Buffer.from(data);
  const xored = Buffer.alloc(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    xored[i] = buffer[i] ^ key.charCodeAt(i % key.length);
  }
  return xored.toString('utf8');
}
