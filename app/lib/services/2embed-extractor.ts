/**
 * 2Embed Extractor with Multi-Quality Support
 * Direct extraction via 2embed.cc → player4u → yesmovies.baby
 */

interface QualityOption {
  quality: string;
  url: string;
  title: string;
}

interface StreamSource {
  quality: string;
  url: string;
  title: string;
  referer: string;
  type: 'hls' | 'm3u8';
  requiresSegmentProxy?: boolean;
}

interface ExtractionResult {
  success: boolean;
  sources: StreamSource[];
  error?: string;
}

/**
 * Fetch with proper headers and timeout
 */
async function fetchWithHeaders(url: string, referer?: string, timeoutMs: number = 10000): Promise<string> {
  const headers: HeadersInit = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };

  if (referer) {
    headers['Referer'] = referer;
  }

  // Add timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { 
      headers,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.text();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Extract quality options from player4u HTML
 */
function extractQualityOptions(html: string): QualityOption[] {
  const qualityRegex = /go\('([^']+)'\)/g;
  const qualityMatches = Array.from(html.matchAll(qualityRegex));
  
  const qualities: Record<string, QualityOption[]> = {
    '2160p': [],
    '1080p': [],
    '720p': [],
    '480p': [],
    'other': []
  };

  for (const match of qualityMatches) {
    const url = match[1];
    
    // Extract title from URL
    const titleMatch = url.match(/tit=([^&]+)/);
    const title = titleMatch ? decodeURIComponent(titleMatch[1].replace(/\+/g, ' ')) : 'Unknown';
    
    const urlLower = url.toLowerCase();
    
    let quality = 'other';
    if (urlLower.includes('2160p') || urlLower.includes('4k') || urlLower.includes('uhd')) {
      quality = '2160p';
    } else if (urlLower.includes('1080p')) {
      quality = '1080p';
    } else if (urlLower.includes('720p')) {
      quality = '720p';
    } else if (urlLower.includes('480p')) {
      quality = '480p';
    }

    qualities[quality].push({ quality, url, title });
  }

  // Return ALL sources, sorted by quality (highest first)
  const allSources: QualityOption[] = [];
  
  // Add in quality order: 2160p, 1080p, 720p, 480p, other
  const qualityOrder = ['2160p', '1080p', '720p', '480p', 'other'];
  
  for (const quality of qualityOrder) {
    if (qualities[quality].length > 0) {
      allSources.push(...qualities[quality]);
    }
  }

  return allSources;
}

/**
 * Decode JWPlayer config from yesmovies.baby HTML
 */
function decodeJWPlayer(html: string): Record<string, string> | null {
  const evalStart = html.indexOf("eval(function(p,a,c,k,e,d)");
  if (evalStart === -1) return null;
  
  let depth = 0;
  let evalEnd = -1;
  for (let i = evalStart + 4; i < html.length; i++) {
    if (html[i] === '(') depth++;
    if (html[i] === ')') {
      depth--;
      if (depth === 0) {
        evalEnd = i;
        break;
      }
    }
  }
  
  const evalStr = html.substring(evalStart, evalEnd + 1);
  const argsMatch = evalStr.match(/\}\('(.+)',(\d+),(\d+),'(.+)'\.split\('\|'\)\)\)$/);
  if (!argsMatch) return null;
  
  const [, packed, radix, count, dictionaryStr] = argsMatch;
  const dictionary = dictionaryStr.split('|');

  let decoded = packed;
  for (let i = parseInt(count) - 1; i >= 0; i--) {
    if (dictionary[i]) {
      const regex = new RegExp('\\b' + i.toString(parseInt(radix)) + '\\b', 'g');
      decoded = decoded.replace(regex, dictionary[i]);
    }
  }

  const sourcesMatch = decoded.match(/\{[^}]*"hls\d+"[^}]*\}/);
  if (!sourcesMatch) return null;

  try {
    return JSON.parse(sourcesMatch[0]);
  } catch {
    return null;
  }
}

/**
 * Extract stream from a single quality option
 */
async function extractStreamFromQuality(
  qualityOption: QualityOption,
  player4uUrl: string
): Promise<StreamSource | null> {
  try {
    // Step 1: Fetch /swp/ page
    const swpUrl = `https://player4u.xyz${qualityOption.url}`;
    const swpHtml = await fetchWithHeaders(swpUrl, player4uUrl);
    
    // Step 2: Extract iframe src
    const iframeMatch = swpHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (!iframeMatch) return null;
    
    const iframeId = iframeMatch[1];
    const yesmoviesUrl = `https://yesmovies.baby/e/${iframeId}`;
    
    // Step 3: Fetch yesmovies.baby page
    const yesmoviesHtml = await fetchWithHeaders(yesmoviesUrl, swpUrl);
    
    // Step 4: Decode JWPlayer config
    const sources = decodeJWPlayer(yesmoviesHtml);
    if (!sources) return null;
    
    // Prefer hls3 (.txt) > hls2 > hls4
    const streamUrl = sources.hls3 || sources.hls2 || sources.hls4;
    if (!streamUrl) return null;
    
    // Handle relative URLs
    const finalUrl = streamUrl.startsWith('http') 
      ? streamUrl 
      : `https://yesmovies.baby${streamUrl}`;
    
    return {
      quality: qualityOption.quality,
      title: qualityOption.title,
      url: finalUrl,
      referer: 'https://www.2embed.cc',
      type: finalUrl.includes('.txt') ? 'hls' : 'm3u8',
      requiresSegmentProxy: true // 2embed streams need referer on ALL requests
    };
  } catch (error) {
    console.error(`Failed to extract ${qualityOption.quality}:`, error);
    return null;
  }
}

/**
 * Main extraction function
 */
export async function extract2EmbedStreams(
  imdbId: string,
  season?: number,
  episode?: number
): Promise<ExtractionResult> {
  try {
    // Step 1: Fetch 2embed.cc page
    const embedUrl = season !== undefined && episode !== undefined
      ? `https://www.2embed.cc/embedtv/${imdbId}&s=${season}&e=${episode}`
      : `https://www.2embed.cc/embed/${imdbId}`;
    
    const embedHtml = await fetchWithHeaders(embedUrl);
    
    // Step 2: Extract player4u URL from myDropdown
    const serverRegex = /onclick="go\('([^']+)'\)"/g;
    const serverMatches = Array.from(embedHtml.matchAll(serverRegex));
    const player4uUrl = serverMatches.find(m => m[1].includes('player4u'))?.[1];
    
    if (!player4uUrl) {
      return {
        success: false,
        sources: [],
        error: 'No player4u URL found'
      };
    }
    
    // Step 3: Fetch player4u page
    const player4uHtml = await fetchWithHeaders(player4uUrl, embedUrl);
    
    // Step 4: Extract quality options
    const qualityOptions = extractQualityOptions(player4uHtml);
    
    if (qualityOptions.length === 0) {
      return {
        success: false,
        sources: [],
        error: 'No quality options found'
      };
    }
    
    // Step 5: Extract streams for each quality (parallel)
    const streamPromises = qualityOptions.map(opt => 
      extractStreamFromQuality(opt, player4uUrl)
    );
    
    const streams = await Promise.all(streamPromises);
    const validStreams = streams.filter((s): s is StreamSource => s !== null);
    
    if (validStreams.length === 0) {
      return {
        success: false,
        sources: [],
        error: 'Failed to extract any streams'
      };
    }
    
    return {
      success: true,
      sources: validStreams
    };
  } catch (error) {
    return {
      success: false,
      sources: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
