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
    const response = await fetchWithHeaders(url, referer, 5000, 'HEAD');
    return response.ok ? 'working' : 'down';
  } catch {
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
    'italian', 'italiano', 'portuguese', 'português', 'russian', 'hindi', 'subtitulado'
  ];

  if (lowerTitle.includes('english') || lowerTitle.includes('eng')) {
    return true;
  }

  for (const keyword of nonEnglishKeywords) {
    if (lowerTitle.includes(keyword)) {
      return false;
    }
  }

  return true;
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
    let mainPart = '';
    
    if (parts.length >= 3) {
      // Has subdomain - take the second-to-last meaningful part
      mainPart = parts[parts.length - 2];
    } else if (parts.length === 2) {
      // No subdomain - take the first part
      mainPart = parts[0];
    } else {
      mainPart = hostname;
    }
    
    // Skip if it looks like a generic CDN name
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
 * Extract quality options from player4u HTML
 * Extracts titles from <li> elements containing go() onclick handlers
 * Format: <li><a onclick="go('/swp/?...')">...&nbsp; TITLE HERE</a></li>
 */
function extractQualityOptions(html: string): QualityOption[] {
  // Match <li> elements containing go() calls and extract both URL and title text
  // The title is in the text content after &nbsp;
  const liRegex = /<li[^>]*><a[^>]*onclick="go\('([^']+)'\)"[^>]*>.*?&nbsp;\s*([^<]+)<\/a><\/li>/gi;
  const liMatches = Array.from(html.matchAll(liRegex));

  const qualities: Record<string, QualityOption[]> = {
    '2160p': [], '1080p': [], '720p': [], '480p': [], '360p': [], 'other': []
  };

  let sourceCounter = 1;

  // First try the <li> regex which includes titles
  for (const match of liMatches) {
    const url = match[1];
    let title = match[2]?.trim() || '';

    // Normalize spaces
    title = title.replace(/\s+/g, ' ').trim();

    // Detect quality from title
    const titleLower = title.toLowerCase();

    let detectedQuality = 'other';
    
    if (titleLower.includes('2160p') || titleLower.includes('4k') || titleLower.includes('uhd')) {
      detectedQuality = '2160p';
    } else if (titleLower.includes('1080p')) {
      detectedQuality = '1080p';
    } else if (titleLower.includes('720p')) {
      detectedQuality = '720p';
    } else if (titleLower.includes('480p')) {
      detectedQuality = '480p';
    } else if (titleLower.includes('360p')) {
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

  // Fallback: if no <li> matches found, try simple go() regex
  if (Object.values(qualities).every(arr => arr.length === 0)) {
    const fallbackRegex = /go\('([^']+)'\)/g;
    const fallbackMatches = Array.from(html.matchAll(fallbackRegex));
    
    for (const match of fallbackMatches) {
      const url = match[1];
      // Try to get title from URL's tit parameter (old format)
      const titleMatch = url.match(/tit=([^&]+)/);
      let title = titleMatch ? decodeURIComponent(titleMatch[1].replace(/\+/g, ' ')) : '';
      title = title.replace(/\s+/g, ' ').trim();

      if (!title || title.length < 3) {
        title = `2Embed Source #${sourceCounter}`;
        sourceCounter++;
      }

      if (!isEnglishSource(title)) {
        continue;
      }

      qualities['other'].push({ quality: title, url, title });
    }
  }

  // Return ALL sources, sorted by quality (highest first)
  const allSources: QualityOption[] = [];
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
 * Extract stream from a single quality option
 */
async function extractStreamFromQuality(
  qualityOption: QualityOption,
  player4uUrl: string,
  sourceIndex: number
): Promise<StreamSource | null> {
  try {
    const swpUrl = `https://player4u.xyz${qualityOption.url}`;
    const swpResponse = await fetchWithHeaders(swpUrl, player4uUrl);
    const swpHtml = await swpResponse.text();

    const iframeMatch = swpHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (!iframeMatch) return null;

    const iframeId = iframeMatch[1];
    const yesmoviesUrl = `https://yesmovies.baby/e/${iframeId}`;

    const yesmoviesResponse = await fetchWithHeaders(yesmoviesUrl, swpUrl);
    const yesmoviesHtml = await yesmoviesResponse.text();

    const sources = decodeJWPlayer(yesmoviesHtml);
    if (!sources) return null;

    const streamUrl = sources.hls3 || sources.hls2 || sources.hls4;
    if (!streamUrl) return null;

    const finalUrl = streamUrl.startsWith('http')
      ? streamUrl
      : `https://yesmovies.baby${streamUrl}`;

    const referer = 'https://www.2embed.cc';
    const status = await checkStreamAvailability(finalUrl, referer);

    // Use the title from the quality option (extracted from player4u HTML)
    // This contains the actual source name like "Fight Club 1999 REMASTERED 1080p BluRay"
    let displayTitle = qualityOption.title;
    
    // If no title from quality option, fall back to domain-based naming
    if (!displayTitle || displayTitle.startsWith('2Embed Source')) {
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

      displayTitle = qualityLabel 
        ? `${sourceName} ${qualityLabel} #${sourceIndex}`
        : `${sourceName} #${sourceIndex}`;
    }

    return {
      quality: displayTitle,
      title: displayTitle,
      url: finalUrl,
      referer,
      type: finalUrl.includes('.txt') ? 'hls' : 'm3u8',
      requiresSegmentProxy: true,
      status
    };
  } catch (error) {
    console.error(`Failed to extract source #${sourceIndex}:`, error);
    return null;
  }
}

/**
 * Try to extract from a specific 2embed URL
 */
async function tryExtractFrom2Embed(embedUrl: string): Promise<ExtractionResult> {
  const embedResponse = await fetchWithHeaders(embedUrl);
  const embedHtml = await embedResponse.text();

  if (embedHtml.includes('not found') || embedHtml.includes('No results') || embedHtml.length < 1000) {
    return {
      success: false,
      sources: [],
      error: 'Content not found on 2embed'
    };
  }

  const serverRegex = /onclick="go\('([^']+)'\)"/g;
  const serverMatches = Array.from(embedHtml.matchAll(serverRegex));
  
  const player4uUrl = serverMatches.find(m => m[1].includes('player4u'))?.[1];
  
  if (!player4uUrl) {
    console.log('[2Embed] No player4u URL found');
    return {
      success: false,
      sources: [],
      error: 'No player4u URL found'
    };
  }

  const player4uResponse = await fetchWithHeaders(player4uUrl, embedUrl);
  const player4uHtml = await player4uResponse.text();

  const qualityOptions = extractQualityOptions(player4uHtml);

  if (qualityOptions.length === 0) {
    return {
      success: false,
      sources: [],
      error: 'No quality options found'
    };
  }

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
}

/**
 * Check if a source title matches the expected content
 * Returns true if the title appears to be for the correct content
 */
function isContentMatch(sourceTitle: string, expectedTitle: string, season?: number, episode?: number): boolean {
  const sourceLower = sourceTitle.toLowerCase();
  const expectedLower = expectedTitle.toLowerCase();
  
  // Block obvious adult content
  const adultKeywords = ['porn', 'xxx', 'adult', 'sex', 'nude', 'erotic', 'onlyfans', 'brazzers', 'pornhub', 'xvideos'];
  for (const keyword of adultKeywords) {
    if (sourceLower.includes(keyword)) {
      console.log(`[2Embed] Blocked adult content: "${sourceTitle}"`);
      return false;
    }
  }
  
  // Extract key words from expected title (remove common words)
  const stopWords = ['the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or', 'but'];
  const expectedWords = expectedLower
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.includes(w));
  
  // Check if at least 50% of expected words are in the source title
  let matchCount = 0;
  for (const word of expectedWords) {
    if (sourceLower.includes(word)) {
      matchCount++;
    }
  }
  
  const matchRatio = expectedWords.length > 0 ? matchCount / expectedWords.length : 0;
  
  // For TV shows, also check season/episode match
  if (season !== undefined && episode !== undefined) {
    // Check for season/episode patterns like S01E01, s1e1, Season 1 Episode 1
    const sePattern = new RegExp(`s0?${season}e0?${episode}|season\\s*${season}.*episode\\s*${episode}`, 'i');
    const hasCorrectEpisode = sePattern.test(sourceTitle);
    
    // If it has episode info but wrong episode, reject it
    const anyEpisodePattern = /s\d+e\d+|season\s*\d+.*episode\s*\d+/i;
    if (anyEpisodePattern.test(sourceTitle) && !hasCorrectEpisode) {
      console.log(`[2Embed] Wrong episode: "${sourceTitle}" (expected S${season}E${episode})`);
      return false;
    }
  }
  
  // Require at least 40% word match for title validation
  if (matchRatio < 0.4) {
    console.log(`[2Embed] Title mismatch (${Math.round(matchRatio * 100)}% match): "${sourceTitle}" vs expected "${expectedTitle}"`);
    return false;
  }
  
  return true;
}

/**
 * Main extraction function
 */
export async function extract2EmbedStreams(
  imdbId: string,
  season?: number,
  episode?: number,
  tmdbId?: string,
  expectedTitle?: string
): Promise<ExtractionResult> {
  const errors: string[] = [];
  const urlsToTry: string[] = [];
  
  if (imdbId) {
    const imdbUrl = season !== undefined && episode !== undefined
      ? `https://www.2embed.cc/embedtv/${imdbId}&s=${season}&e=${episode}`
      : `https://www.2embed.cc/embed/${imdbId}`;
    urlsToTry.push(imdbUrl);
  }
  
  if (tmdbId && tmdbId !== imdbId) {
    const tmdbUrl = season !== undefined && episode !== undefined
      ? `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`
      : `https://www.2embed.cc/embed/${tmdbId}`;
    urlsToTry.push(tmdbUrl);
  }

  for (const embedUrl of urlsToTry) {
    try {
      console.log(`[2Embed] Trying URL: ${embedUrl}`);
      const result = await tryExtractFrom2Embed(embedUrl);
      
      if (result.success && result.sources.length > 0) {
        // If we have an expected title, filter sources to only include matching content
        if (expectedTitle) {
          const validatedSources = result.sources.filter(source => 
            isContentMatch(source.title, expectedTitle, season, episode)
          );
          
          if (validatedSources.length > 0) {
            console.log(`[2Embed] ${validatedSources.length}/${result.sources.length} sources passed content validation`);
            return {
              success: true,
              sources: validatedSources
            };
          } else {
            console.warn(`[2Embed] All ${result.sources.length} sources failed content validation for "${expectedTitle}"`);
            errors.push(`${embedUrl}: Content mismatch - sources don't match expected title`);
            continue;
          }
        }
        
        console.log(`[2Embed] Success with URL: ${embedUrl}`);
        return result;
      }
      
      if (result.error) {
        errors.push(`${embedUrl}: ${result.error}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`${embedUrl}: ${errorMsg}`);
      console.warn(`[2Embed] Failed with URL ${embedUrl}:`, errorMsg);
    }
  }

  return {
    success: false,
    sources: [],
    error: errors.length > 0 ? errors.join('; ') : 'No valid 2embed URLs to try'
  };
}
