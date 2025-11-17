/**
 * VidSrc RCP Extractor
 * 
 * Complete extraction flow using the RCP infrastructure
 * Goes to vidsrc-embed.ru → cloudnestra.com/rcp → cloudnestra.com/prorcp
 */

import { httpClient } from './rcp/http-client';
import { hashExtractor } from './rcp/hash-extractor';
import { rcpFetcher } from './rcp/rcp-fetcher';
import { proRcpExtractor } from './rcp/prorcp-extractor';
import { tryAllDecoders } from './rcp/srcrcp-decoder';
import { resolvePlaceholders } from './rcp/placeholder-resolver';
import { generateRequestId } from './rcp/request-id';

export interface VidSrcRequest {
  tmdbId: string;
  type: 'movie' | 'tv';
  season?: number;
  episode?: number;
}

export interface VidSrcResult {
  success: boolean;
  url?: string;
  urls?: string[];
  provider: string;
  error?: string;
}

/**
 * Extract stream from VidSrc using RCP infrastructure
 */
export async function extractVidSrcRCP(request: VidSrcRequest): Promise<VidSrcResult> {
  const { tmdbId, type, season, episode } = request;
  const requestId = generateRequestId();
  
  try {
    console.log('[VidSrc RCP] Starting extraction', { tmdbId, type, season, episode });
    
    // Step 1: Build embed URL
    let embedUrl = `https://vidsrc-embed.ru/embed/${type}/${tmdbId}`;
    if (type === 'tv' && season && episode) {
      embedUrl += `/${season}/${episode}`;
    }
    
    console.log('[VidSrc RCP] Fetching embed page:', embedUrl);
    
    // Step 2: Get embed page and extract hash
    const embedResponse = await httpClient.fetch(embedUrl, {
      timeout: 10000,
      referer: 'https://vidsrc-embed.ru/'
    }, requestId);
    
    const hash = hashExtractor.extract(embedResponse.body, '2embed', requestId);
    if (!hash) {
      throw new Error('No hash found in embed page');
    }
    
    console.log('[VidSrc RCP] Extracted hash:', hash.substring(0, 20) + '...');
    
    // Step 3: Get RCP page
    const rcpHtml = await rcpFetcher.fetch(hash, requestId, {
      referer: embedUrl
    });
    
    // Extract ProRCP URL using the ProRCP extractor
    const proRcpUrl = proRcpExtractor.extract(rcpHtml, '2embed', requestId);
    if (!proRcpUrl) {
      throw new Error('No ProRCP URL found in RCP page');
    }
    
    // Extract hash from URL
    const proRcpMatch = proRcpUrl.match(/\/prorcp\/([A-Za-z0-9+\/=\-_]+)/);
    if (!proRcpMatch) {
      throw new Error('Invalid ProRCP URL format');
    }
    
    const proRcpHash = proRcpMatch[1];
    console.log('[VidSrc RCP] Got ProRCP hash:', proRcpHash.substring(0, 20) + '...');
    
    // Step 4: Get ProRCP page with proper headers (CRITICAL: Must use vidsrc-embed.ru as referer!)
    const proRcpPageUrl = `https://cloudnestra.com/prorcp/${proRcpHash}`;
    const proRcpResponse = await httpClient.fetch(proRcpPageUrl, {
      timeout: 10000,
      referer: embedUrl, // MUST be vidsrc-embed.ru, not cloudnestra.com!
      origin: 'https://vidsrc-embed.ru'
    }, requestId);
    
    // Extract hidden div using regex
    const hiddenDivMatch = proRcpResponse.body.match(/<div[^>]+id="([^"]+)"[^>]+style="display:none;">([^<]+)<\/div>/);
    if (!hiddenDivMatch) {
      throw new Error('No hidden div found in ProRCP page');
    }
    
    const hiddenDiv = {
      divId: hiddenDivMatch[1],
      encoded: hiddenDivMatch[2]
    };
    
    console.log('[VidSrc RCP] Extracted hidden div:', hiddenDiv.divId);
    
    // Step 5: Decode the hidden div content using ULTIMATE DECODER (100% coverage)
    console.log('[VidSrc RCP] Using Ultimate Decoder (100% coverage)');
    const { decodeWithCache } = await import('./rcp/ultimate-decoder');
    
    const ultimateResult = decodeWithCache(
      hiddenDiv.encoded,
      hiddenDiv.divId,
      '' // dataI not needed
    );
    
    let decoderResult;
    
    if (ultimateResult.success && ultimateResult.url) {
      console.log('[VidSrc RCP] ✅ Ultimate Decoder SUCCESS with method:', ultimateResult.method);
      decoderResult = {
        url: ultimateResult.url,
        method: ultimateResult.method || 'ultimate-decoder',
        urls: [ultimateResult.url]
      };
    } else {
      // Fallback to legacy decoders
      console.log('[VidSrc RCP] Ultimate decoder failed, trying legacy decoders...');
      decoderResult = await tryAllDecoders(
        hiddenDiv.encoded,
        hiddenDiv.divId,
        requestId
      );
      
      if (!decoderResult) {
        // Final fallback: Try Puppeteer decoder (slow but works for new encodings)
        console.log('[VidSrc RCP] All static decoders failed, trying Puppeteer decoder...');
        try {
          const { decode: decodeWithPuppeteer } = await import('./rcp/puppeteer-decoder');
          const puppeteerUrl = await decodeWithPuppeteer(hiddenDiv.encoded, hiddenDiv.divId, '');
          
          if (puppeteerUrl && typeof puppeteerUrl === 'string' && puppeteerUrl.length > 0) {
            console.log('[VidSrc RCP] ✅ Puppeteer decoder SUCCESS');
            decoderResult = {
              url: puppeteerUrl,
              method: 'puppeteer-live-decoder',
              urls: [puppeteerUrl]
            };
          } else {
            throw new Error(`The stream provider has updated their encoding method. All 36+ decoder methods failed. This title is temporarily unavailable until the new encoding is reverse-engineered. Please try a different title.`);
          }
        } catch (puppeteerError) {
          console.error('[VidSrc RCP] Puppeteer decoder also failed:', puppeteerError);
          throw new Error(`The stream provider has updated their encoding method. All decoder methods (including Puppeteer) failed. This title is temporarily unavailable.`);
        }
      }
    }
    
    console.log('[VidSrc RCP] Decoded successfully with method:', decoderResult.method);
    
    // Step 6: Clean decoded URL (remove " or " separators if present)
    let cleanUrl = decoderResult.url;
    if (cleanUrl.includes(' or ')) {
      const urlParts = cleanUrl.split(' or ');
      cleanUrl = urlParts[0].trim();
      console.log('[VidSrc RCP] Found multiple URLs separated by " or ", using first:', cleanUrl.substring(0, 100));
    }
    
    // Step 7: Resolve placeholders
    const urls = resolvePlaceholders(cleanUrl, requestId);
    
    if (urls.length === 0) {
      throw new Error('No valid URLs after placeholder resolution');
    }
    
    console.log('[VidSrc RCP] Extraction complete, found', urls.length, 'URLs');
    
    return {
      success: true,
      url: urls[0],
      urls,
      provider: 'vidsrc-rcp'
    };
    
  } catch (error) {
    console.error('[VidSrc RCP] Extraction failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: 'vidsrc-rcp'
    };
  }
}
