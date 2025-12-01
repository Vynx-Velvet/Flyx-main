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
  status?: 'working' | 'down' | 'unknown';
}

interface ExtractionResult {
  success: boolean;
  sources: StreamSource[];
  error?: string;
}

/**
 * Fetch with proper headers and timeout
 */
async function fetchWithHeaders(url: string, referer?: string, timeoutMs: number = 15000, method: string = 'GET'): Promise<Response> {
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
      method,
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Check if a stream URL is reachable
 */
async function checkStreamAvailability(url: string, referer: string): Promise<'working' | 'down' | 'unknown'> {
  try {
    // Use a shorter timeout for availability checks to avoid slowing down the UI too much
    const response = await fetchWithHeaders(url, referer, 5000, 'HEAD');
    return response.ok ? 'working' : 'down';
  } catch (error) {
    console.warn(`[2Embed] Availability check failed for ${url}:`, error);
    return 'down';
  }
}

/**
 * Check if a source title indicates English content
 */
function isEnglishSource(title: string): boolean {
  const lowerTitle = title.toLowerCase();
  const nonEnglishKeywords = [
    'latino', 'spanish', 'español', 'french', 'français', 'german', 'deutsch',
    'italian', 'italiano', 'portuguese', 'português', 'russian', 'hindi',
    'subtitulado', 'dubbed' // Sometimes "dubbed" implies non-English dub, but context matters. 
    // For now, let's assume "dubbed" usually means English dub if the site is English-centric,
    // OR it means foreign language dubbed into English.
    // However, if the user wants STRICT English, we might want to be careful.
    // Let's stick to explicit language names for now.
  ];

  // If it explicitly says "English" or "Eng", it's definitely English
  if (lowerTitle.includes('english') || lowerTitle.includes('eng')) {
    return true;
  }

  // Check for non-English keywords
  for (const keyword of nonEnglishKeywords) {
    if (lowerTitle.includes(keyword)) {
      return false;
    }
  }

  // Default to true if no language is specified (assume original audio/English)
  return true;
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
    '360p': [],
    'other': []
  };

  // Counter for generating unique source names when title is missing
  let sourceCounter = 1;

  for (const match of qualityMatches) {
    const url = match[1];

    // Extract title from URL's tit parameter - this IS the filename/source name
    const titleMatch = url.match(/tit=([^&]+)/);
    let title = titleMatch ? decodeURIComponent(titleMatch[1].replace(/\+/g, ' ')) : '';

    // Normalize spaces only, keep the full filename intact
    title = title.replace(/\s+/g, ' ').trim();

    // Detect quality from URL or title
    const urlLower = url.toLowerCase();
    const titleLower = title.toLowerCase();

    let detectedQuality = 'other';
    
    if (urlLower.includes('2160p') || urlLower.includes('4k') || urlLower.includes('uhd') ||
      titleLower.includes('2160p') || titleLower.includes('4k') || titleLower.includes('uhd')) {
      detectedQuality = '2160p';
    } else if (urlLower.includes('1080p') || titleLower.includes('1080p')) {
      detectedQuality = '1080p';
    } else if (urlLower.includes('720p') || titleLower.includes('720p')) {
      detectedQuality = '720p';
    } else if (urlLower.includes('480p') || titleLower.includes('480p')) {
      detectedQuality = '480p';
    } else if (urlLower.includes('360p') || titleLower.includes('360p')) {
      detectedQuality = '360p';
    }

    // If no title found, generate a fallback name
    if (!title || title.length < 3) {
      title = `2Embed Source #${sourceCounter}`;
      sourceCounter++;
    }

    // Filter out non-English sources
    if (!isEnglishSource(title)) {
      continue;
    }

    // Store with the full filename as the title
    qualities[detectedQuality].push({ quality: title, url, title });
  }

  // Return ALL sources, sorted by quality (highest first)
  const allSources: QualityOption[] = [];

  // Add in quality order: 2160p, 1080p, 720p, 480p, 360p, other
  const qualityOrder = ['2160p', '1080p', '720p', '480p', '360p', 'other'];

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
 * Extract domain name from URL for display
 * e.g., "54pkdcyxbsxbermn.premilkyway.com" -> "Premilkyway"
 * e.g., "54pkdcyxbsxbermn.aurorionproductions.cyou" -> "Aurorionproductions"
 */
function extractSourceName(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Split by dots
    const parts = hostname.split('.');
    
    // Find the main domain part (not the random subdomain, not the TLD)
    // For "54pkdcyxbsxbermn.premilkyway.com" -> "premilkyway"
    // For "yesmovies.baby" -> "yesmovies"
    let mainPart = '';
    
    if (parts.length >= 3) {
      // Has subdomain - take the second-to-last meaningful part
      // e.g., ["54pkdcyxbsxbermn", "premilkyway", "com"] -> "premilkyway"
      mainPart = parts[parts.length - 2];
    } else if (parts.length === 2) {
      // No subdomain - take the first part
      // e.g., ["yesmovies", "baby"] -> "yesmovies"
      mainPart = parts[0];
    } else {
      mainPart = hostname;
    }
    
    // Skip if it looks like a random string (all lowercase letters/numbers, no vowels pattern)
    // or if it's a common CDN/generic name
    const genericNames = ['cdn', 'stream', 'video', 'hls', 'play', 'watch', 'embed'];
    if (genericNames.includes(mainPart.toLowerCase())) {
      // Try the subdomain instead
      if (parts.length >= 3) {
        mainPart = parts[0];
      }
    }
    
    // Capitalize first letter
    mainPart = mainPart.charAt(0).toUpperCase() + mainPart.slice(1).toLowerCase();
    
    return mainPart;
  } catch {
    return 'Stream';
  }
}

/**
 * Extract stream from a single quality option
 */
async function extractStreamFromQuality(
  qualityOption: QualityOption,
  player4uUrl: string,
  sourceIndex: number
): Promise<StreamSource | null> {
  try {
    // Step 1: Fetch /swp/ page
    const swpUrl = `https://player4u.xyz${qualityOption.url}`;
    const swpResponse = await fetchWithHeaders(swpUrl, player4uUrl);
    const swpHtml = await swpResponse.text();

    // Step 2: Extract iframe src
    const iframeMatch = swpHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (!iframeMatch) return null;

    const iframeId = iframeMatch[1];
    const yesmoviesUrl = `https://yesmovies.baby/e/${iframeId}`;

    // Step 3: Fetch yesmovies.baby page
    const yesmoviesResponse = await fetchWithHeaders(yesmoviesUrl, swpUrl);
    const yesmoviesHtml = await yesmoviesResponse.text();

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

    const referer = 'https://www.2embed.cc';

    // Check availability
    const status = await checkStreamAvailability(finalUrl, referer);

    // Extract source name from the final stream URL domain
    const sourceName = extractSourceName(finalUrl);
    
    // Detect quality from URL if possible
    const urlLower = finalUrl.toLowerCase();
    let qualityLabel = '';
    if (urlLower.includes('1080') || urlLower.includes('fhd')) {
      qualityLabel = '1080p';
    } else if (urlLower.includes('720') || urlLower.includes('hd')) {
      qualityLabel = '720p';
    } else if (urlLower.includes('480') || urlLower.includes('sd')) {
      qualityLabel = '480p';
    } else if (urlLower.includes('4k') || urlLower.includes('2160')) {
      qualityLabel = '4K';
    }

    // Build the display title from the actual source domain
    const displayTitle = qualityLabel 
      ? `${sourceName} ${qualityLabel} #${sourceIndex}`
      : `${sourceName} #${sourceIndex}`;

    return {
      quality: displayTitle,
      title: displayTitle,
      url: finalUrl,
      referer,
      type: finalUrl.includes('.txt') ? 'hls' : 'm3u8',
      requiresSegmentProxy: true, // 2embed streams need referer on ALL requests
      status
    };
  } catch (error) {
    console.error(`Failed to extract source #${sourceIndex}:`, error);
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

    const embedResponse = await fetchWithHeaders(embedUrl);
    const embedHtml = await embedResponse.text();

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
    const player4uResponse = await fetchWithHeaders(player4uUrl, embedUrl);
    const player4uHtml = await player4uResponse.text();

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
    const streamPromises = qualityOptions.map((opt, index) =>
      extractStreamFromQuality(opt, player4uUrl, index + 1)
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
