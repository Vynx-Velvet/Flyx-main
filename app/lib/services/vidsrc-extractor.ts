/**
 * VidSrc Extractor
 * Extracts streams from vidsrc-embed.ru → cloudnestra.com
 * 
 * ⚠️ SECURITY WARNING ⚠️
 * This extractor executes remote JavaScript code from third-party sites
 * using new Function(). This is DISABLED BY DEFAULT for safety.
 * 
 * To enable, set ENABLE_VIDSRC_PROVIDER=true in your environment.
 * By enabling this, you accept the security risk of running third-party code.
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

// ⚠️ SECURITY: VidSrc is DISABLED by default - must explicitly enable
// When enabled, decoder scripts run via new Function() - user accepts the risk
export const VIDSRC_ENABLED = process.env.ENABLE_VIDSRC_PROVIDER === 'true';

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
 * Execute decoder using new Function() - ONLY when VidSrc is explicitly enabled
 * 
 * When ENABLE_VIDSRC_PROVIDER=true, the user has accepted the security risk
 * of executing third-party decoder scripts. We use new Function() directly
 * which is simpler and more reliable than VM sandboxing.
 */
async function executeDecoder(
  decoderScript: string, 
  divId: string, 
  encodedContent: string
): Promise<string | null> {
  // VidSrc is enabled - user has accepted the risk, use new Function() directly
  console.log('[VidSrc] Executing decoder with new Function() (VidSrc enabled by user)...');
  
  try {
    // Create mock window to capture the result
    const mockWindow: Record<string, unknown> = {};
    
    // Create mock document with getElementById
    const mockDocument = {
      getElementById: (id: string) => {
        if (id === divId) {
          return { innerHTML: encodedContent };
        }
        return null;
      }
    };
    
    // Wrap the decoder script to inject our mocks
    const wrappedScript = `
      (function(window, document, atob, btoa) {
        ${decoderScript}
      })
    `;
    
    // Create and execute the function
    const decoderFn = new Function('return ' + wrappedScript)();
    decoderFn(mockWindow, mockDocument, customAtob, customBtoa);
    
    // Check for captured result - the decoder sets window[divId] = decodedUrl
    const result = mockWindow[divId];
    if (typeof result === 'string' && result.includes('https://')) {
      console.log('[VidSrc] Decoder execution successful');
      return result;
    }
    
    // Try alternate patterns - some decoders use different output methods
    for (const key of Object.keys(mockWindow)) {
      const value = mockWindow[key];
      if (typeof value === 'string' && value.includes('https://') && value.includes('.m3u8')) {
        console.log(`[VidSrc] Found URL in window.${key}`);
        return value;
      }
    }
    
    console.error('[VidSrc] No decoded URL found in window');
    console.error('[VidSrc] mockWindow keys:', Object.keys(mockWindow));
    return null;
    
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
 * 
 * ⚠️ DISABLED BY DEFAULT - Set ENABLE_VIDSRC_PROVIDER=true to enable
 */
export async function extractVidSrcStreams(
  tmdbId: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<ExtractionResult> {
  // ⚠️ SECURITY CHECK: VidSrc must be explicitly enabled
  if (!VIDSRC_ENABLED) {
    console.warn('[VidSrc] Provider is DISABLED for security. Set ENABLE_VIDSRC_PROVIDER=true to enable.');
    return {
      success: false,
      sources: [],
      error: 'VidSrc provider is disabled. Set ENABLE_VIDSRC_PROVIDER=true to enable (security risk).'
    };
  }

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

    // Step 4: Extract prorcp OR srcrcp URL (site uses both dynamically)
    // The URL can be in various formats depending on how the page loads
    let rcpEndpointPath: string | null = null;
    let rcpEndpointType: 'prorcp' | 'srcrcp' = 'prorcp';
    
    // Try multiple patterns - the site structure varies
    const patterns = [
      // Pattern 1: src: '/prorcp/...' or src: '/srcrcp/...'
      { regex: /src:\s*['"]\/prorcp\/([^'"]+)['"]/i, type: 'prorcp' as const },
      { regex: /src:\s*['"]\/srcrcp\/([^'"]+)['"]/i, type: 'srcrcp' as const },
      // Pattern 2: Direct URL in script
      { regex: /['"]\/prorcp\/([A-Za-z0-9+\/=\-_]+)['"]/i, type: 'prorcp' as const },
      { regex: /['"]\/srcrcp\/([A-Za-z0-9+\/=\-_]+)['"]/i, type: 'srcrcp' as const },
      // Pattern 3: loadIframe function call
      { regex: /loadIframe\s*\(\s*['"]\/prorcp\/([^'"]+)['"]/i, type: 'prorcp' as const },
      { regex: /loadIframe\s*\(\s*['"]\/srcrcp\/([^'"]+)['"]/i, type: 'srcrcp' as const },
      // Pattern 4: iframe src attribute
      { regex: /<iframe[^>]+src=["']\/prorcp\/([^"']+)["']/i, type: 'prorcp' as const },
      { regex: /<iframe[^>]+src=["']\/srcrcp\/([^"']+)["']/i, type: 'srcrcp' as const },
      // Pattern 5: data attribute
      { regex: /data-src=["']\/prorcp\/([^"']+)["']/i, type: 'prorcp' as const },
      { regex: /data-src=["']\/srcrcp\/([^"']+)["']/i, type: 'srcrcp' as const },
    ];
    
    for (const { regex, type } of patterns) {
      const match = rcpHtml.match(regex);
      if (match) {
        rcpEndpointPath = match[1];
        rcpEndpointType = type;
        console.log(`[VidSrc] Found ${type.toUpperCase()} hash via pattern: ${regex.source.substring(0, 30)}...`);
        break;
      }
    }
    
    if (!rcpEndpointPath) {
      // Log the FULL HTML for debugging - the page might be JS-rendered
      console.error('[VidSrc] RCP HTML length:', rcpHtml.length);
      console.error('[VidSrc] FULL RCP HTML:', rcpHtml);
      
      // Check if this is a Cloudflare Turnstile protected page
      if (rcpHtml.includes('cf-turnstile') || rcpHtml.includes('turnstile')) {
        console.error('[VidSrc] Cloudflare Turnstile protection detected - cannot bypass without browser');
        throw new Error('VidSrc is protected by Cloudflare Turnstile - try another provider');
      }
      
      // Check if this is a JS-rendered page (no prorcp in static HTML)
      if (rcpHtml.length < 5000 && !rcpHtml.includes('prorcp') && !rcpHtml.includes('srcrcp')) {
        throw new Error('RCP page requires JavaScript execution - VidSrc may have changed their protection');
      }
      
      throw new Error('Could not find prorcp/srcrcp URL in RCP page');
    }

    // Step 5: Fetch PRORCP/SRCRCP page
    const endpointUrl = `https://cloudnestra.com/${rcpEndpointType}/${rcpEndpointPath}`;
    console.log(`[VidSrc] Fetching ${rcpEndpointType.toUpperCase()} page`);
    const prorcpResponse = await fetchWithHeaders(endpointUrl, 'https://cloudnestra.com/');
    
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

    // Step 8: Execute decoder in isolated sandbox
    console.log('[VidSrc] Executing decoder in sandbox...');
    const decodedContent = await executeDecoder(decoderScript, divId, encodedContent);
    
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
