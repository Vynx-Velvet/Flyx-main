/**
 * VidSrc Extractor
 * Extracts streams from vidsrc-embed.ru → cloudnestra.com
 * Uses Function constructor for Edge/Vercel compatibility (no vm module)
 */

interface StreamSource {
  quality: string;
  title: string;
  url: string;
  type: 'hls';
  referer: string;
  requiresSegmentProxy: boolean;
  status?: 'working' | 'down';
}

interface ExtractionResult {
  success: boolean;
  sources: StreamSource[];
  error?: string;
}

// Domain for stream URLs
const STREAM_DOMAIN = 'shadowlandschronicles.com';

/**
 * Fetch with proper headers and timeout
 */
async function fetchWithHeaders(url: string, referer?: string, timeoutMs: number = 15000): Promise<Response> {
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
 * Custom atob for Edge runtime compatibility
 */
function customAtob(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'base64').toString('binary');
  }
  // Edge runtime has native atob
  return atob(str);
}

/**
 * Custom btoa for Edge runtime compatibility  
 */
function customBtoa(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'binary').toString('base64');
  }
  return btoa(str);
}

/**
 * Execute decoder script using Function constructor (Edge/Vercel compatible)
 * The decoder script sets window[divId] = decodedUrl
 */
function executeDecoder(decoderScript: string, divId: string, encodedContent: string): string | null {
  let decodedContent: string | null = null;

  // Create mock window that captures the decoded URL
  const mockWindow: Record<string, any> = {};
  const windowProxy = new Proxy(mockWindow, {
    set: (target, prop, value) => {
      target[prop as string] = value;
      if (typeof value === 'string' && value.includes('https://')) {
        decodedContent = value;
      }
      return true;
    },
    get: (target, prop) => target[prop as string]
  });

  // Mock document.getElementById
  const mockDocument = {
    getElementById: (id: string) => id === divId ? { innerHTML: encodedContent } : null
  };

  try {
    // Create a function that wraps the decoder script with our mocks
    // The decoder script expects: window, document, atob, btoa, setTimeout, setInterval, console
    const wrappedCode = `
      return (function(window, document, atob, btoa, setTimeout, setInterval, console) {
        "use strict";
        ${decoderScript}
      });
    `;
    
    const createRunner = new Function(wrappedCode);
    const runner = createRunner();
    
    runner(
      windowProxy,
      mockDocument,
      customAtob,
      customBtoa,
      (fn: Function) => { if (typeof fn === 'function') fn(); }, // setTimeout - execute immediately
      () => {}, // setInterval - no-op
      { log: () => {}, error: () => {}, warn: () => {} } // silent console
    );
    
    // Check if result was captured via proxy or set directly
    if (!decodedContent && mockWindow[divId]) {
      decodedContent = mockWindow[divId];
    }
    
    return decodedContent;
  } catch (error) {
    console.error('[VidSrc] Decoder execution failed:', error);
    return null;
  }
}

/**
 * Check if a stream URL is accessible
 */
async function checkStreamAvailability(url: string): Promise<'working' | 'down'> {
  try {
    const response = await fetchWithHeaders(url, 'https://cloudnestra.com/', 5000);
    const text = await response.text();
    return response.ok && (text.includes('#EXTM3U') || text.includes('#EXT-X')) ? 'working' : 'down';
  } catch {
    return 'down';
  }
}

/**
 * Main extraction function
 */
export async function extractVidSrcStreams(
  tmdbId: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<ExtractionResult> {
  console.log(`[VidSrc] Extracting streams for ${type} ID ${tmdbId}...`);

  try {
    // Step 1: Fetch vidsrc-embed.ru page
    const embedUrl = type === 'tv' && season && episode
      ? `https://vidsrc-embed.ru/embed/tv/${tmdbId}/${season}/${episode}`
      : `https://vidsrc-embed.ru/embed/movie/${tmdbId}`;
    
    console.log('[VidSrc] Fetching embed page:', embedUrl);
    const embedResponse = await fetchWithHeaders(embedUrl);
    
    if (!embedResponse.ok) {
      throw new Error(`Embed page returned ${embedResponse.status}`);
    }
    
    const embedHtml = await embedResponse.text();

    // Step 2: Extract RCP iframe URL
    const iframeMatch = embedHtml.match(/<iframe[^>]*src=["']([^"']+cloudnestra\.com\/rcp\/([^"']+))["']/i);
    if (!iframeMatch) {
      throw new Error('Could not find RCP iframe in embed page');
    }
    
    const rcpPath = iframeMatch[2];
    console.log('[VidSrc] Found RCP hash');

    // Step 3: Fetch RCP page to get prorcp URL
    const rcpUrl = `https://cloudnestra.com/rcp/${rcpPath}`;
    console.log('[VidSrc] Fetching RCP page');
    const rcpResponse = await fetchWithHeaders(rcpUrl, 'https://vidsrc-embed.ru/');
    
    if (!rcpResponse.ok) {
      throw new Error(`RCP page returned ${rcpResponse.status}`);
    }
    
    const rcpHtml = await rcpResponse.text();

    // Step 4: Extract prorcp URL from loadIframe function
    const prorcpMatch = rcpHtml.match(/src:\s*['"]\/prorcp\/([^'"]+)['"]/);
    if (!prorcpMatch) {
      throw new Error('Could not find prorcp URL in RCP page');
    }
    
    const prorcpPath = prorcpMatch[1];
    console.log('[VidSrc] Found PRORCP hash');

    // Step 5: Fetch PRORCP page
    const prorcpUrl = `https://cloudnestra.com/prorcp/${prorcpPath}`;
    console.log('[VidSrc] Fetching PRORCP page');
    const prorcpResponse = await fetchWithHeaders(prorcpUrl, 'https://cloudnestra.com/');
    
    if (!prorcpResponse.ok) {
      throw new Error(`PRORCP page returned ${prorcpResponse.status}`);
    }
    
    const prorcpHtml = await prorcpResponse.text();

    // Step 6: Extract div ID and encoded content
    const divMatch = prorcpHtml.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
    if (!divMatch) {
      throw new Error('Could not find encoded div in PRORCP page');
    }
    
    const divId = divMatch[1];
    const encodedContent = divMatch[2];
    console.log('[VidSrc] Div ID:', divId, 'Encoded length:', encodedContent.length);

    // Step 7: Extract and fetch decoder script
    const scriptMatch = prorcpHtml.match(/sV05kUlNvOdOxvtC\/([a-f0-9]+)\.js/);
    if (!scriptMatch) {
      throw new Error('Could not find decoder script reference');
    }
    
    const scriptHash = scriptMatch[1];
    const scriptUrl = `https://cloudnestra.com/sV05kUlNvOdOxvtC/${scriptHash}.js?_=${Date.now()}`;
    console.log('[VidSrc] Fetching decoder script');
    
    const scriptResponse = await fetchWithHeaders(scriptUrl, 'https://cloudnestra.com/');
    if (!scriptResponse.ok) {
      throw new Error(`Decoder script returned ${scriptResponse.status}`);
    }
    
    const decoderScript = await scriptResponse.text();
    console.log('[VidSrc] Decoder script length:', decoderScript.length);

    // Step 8: Execute decoder
    console.log('[VidSrc] Executing decoder...');
    const decodedContent = executeDecoder(decoderScript, divId, encodedContent);
    
    if (!decodedContent) {
      throw new Error('Decoder execution failed - no content captured');
    }
    
    console.log('[VidSrc] Decoded successfully, preview:', decodedContent.substring(0, 100));

    // Step 9: Extract m3u8 URLs
    const urls = decodedContent.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/g) || [];
    
    // Replace domain variables and deduplicate
    const resolvedUrls = Array.from(new Set(urls.map(url => url.replace(/\{v\d+\}/g, STREAM_DOMAIN))));
    console.log(`[VidSrc] Found ${resolvedUrls.length} unique m3u8 URLs`);

    if (resolvedUrls.length === 0) {
      throw new Error('No stream URLs found in decoded content');
    }

    // Step 10: Build sources and check availability
    const sources: StreamSource[] = [];
    
    for (let i = 0; i < resolvedUrls.length; i++) {
      const url = resolvedUrls[i];
      
      // Skip URLs with domains that don't resolve (app2, etc.)
      if (url.includes('app2.') || url.includes('app3.')) {
        continue;
      }
      
      const status = await checkStreamAvailability(url);
      
      sources.push({
        quality: 'auto',
        title: `VidSrc ${i + 1}`,
        url,
        type: 'hls',
        referer: 'https://cloudnestra.com/',
        requiresSegmentProxy: true,
        status
      });
    }

    // Filter to working sources first, but include all
    const workingSources = sources.filter(s => s.status === 'working');
    console.log(`[VidSrc] ${workingSources.length}/${sources.length} sources working`);

    if (workingSources.length === 0 && sources.length > 0) {
      return {
        success: false,
        sources,
        error: 'All VidSrc sources currently unavailable'
      };
    }

    if (sources.length === 0) {
      throw new Error('No valid stream sources found');
    }

    return {
      success: true,
      sources
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[VidSrc] Extraction failed:', errorMessage);
    
    return {
      success: false,
      sources: [],
      error: errorMessage
    };
  }
}
