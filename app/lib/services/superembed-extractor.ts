/**
 * Superembed Extractor
 * 
 * Extracts M3U8 streams from Superembed on vidsrc-embed.ru
 * Uses the same RCP infrastructure as other providers but with superembed hash
 */

import { httpClient } from './rcp/http-client';
import { hashExtractor } from './rcp/hash-extractor';
import { rcpFetcher } from './rcp/rcp-fetcher';
import { proRcpExtractor } from './rcp/prorcp-extractor';
import { tryAllDecoders } from './rcp/srcrcp-decoder';
import { resolvePlaceholders } from './rcp/placeholder-resolver';
import { generateRequestId } from './rcp/request-id';

export interface SuperembedRequest {
  tmdbId: string;
  type: 'movie' | 'tv';
  season?: number;
  episode?: number;
}

export interface SuperembedResult {
  success: boolean;
  url?: string;
  urls?: string[];
  provider: string;
  error?: string;
}

/**
 * Extract stream from Superembed using RCP infrastructure
 */
export async function extractSuperembed(request: SuperembedRequest): Promise<SuperembedResult> {
  const { tmdbId, type, season, episode } = request;
  const requestId = generateRequestId();
  
  try {
    console.log('[Superembed] Starting extraction', { tmdbId, type, season, episode });
    
    // Step 1: Build embed URL
    let embedUrl = `https://vidsrc-embed.ru/embed/${type}/${tmdbId}`;
    if (type === 'tv' && season && episode) {
      embedUrl += `/${season}/${episode}`;
    }
    
    console.log('[Superembed] Fetching embed page:', embedUrl);
    
    // Step 2: Get embed page and extract superembed hash
    const embedResponse = await httpClient.fetch(embedUrl, {
      timeout: 10000,
      referer: 'https://vidsrc-embed.ru/'
    }, requestId);
    
    console.log('[Superembed] Embed response body length:', embedResponse.body.length);
    console.log('[Superembed] Checking for Superembed in HTML:', embedResponse.body.includes('Superembed'));
    
    // Extract hash manually (workaround for Bun regex issue)
    const hashPattern = /data-hash="([^"]+)"[^>]*>[\s\S]{0,200}?Superembed/i;
    const hashMatch = embedResponse.body.match(hashPattern);
    
    let hash: string | null = null;
    if (hashMatch && hashMatch[1]) {
      hash = hashMatch[1];
      console.log('[Superembed] Extracted hash with manual pattern');
    } else {
      // Fallback to hash extractor
      hash = hashExtractor.extract(embedResponse.body, 'superembed', requestId);
    }
    
    if (!hash) {
      throw new Error('No superembed hash found in embed page');
    }
    
    console.log('[Superembed] Extracted hash:', hash.substring(0, 20) + '...');
    
    // Step 3: Get RCP page
    const rcpHtml = await rcpFetcher.fetch(hash, requestId, {
      referer: embedUrl
    });
    
    // Extract ProRCP/SrcRCP URL using the ProRCP extractor
    const proRcpUrl = proRcpExtractor.extract(rcpHtml, 'superembed', requestId);
    if (!proRcpUrl) {
      throw new Error('No ProRCP/SrcRCP URL found in RCP page');
    }
    
    // Determine if it's prorcp or srcrcp
    const isSrcRcp = proRcpUrl.includes('/srcrcp/');
    const pathType = isSrcRcp ? 'srcrcp' : 'prorcp';
    
    // Extract hash from URL
    const urlHashMatch = proRcpUrl.match(/\/(prorcp|srcrcp)\/([A-Za-z0-9+\/=\-_]+)/);
    if (!urlHashMatch) {
      throw new Error('Invalid ProRCP/SrcRCP URL format');
    }
    
    const proRcpHash = urlHashMatch[2];
    console.log(`[Superembed] Got ${pathType} hash:`, proRcpHash.substring(0, 20) + '...');
    
    // Step 4: Get ProRCP/SrcRCP page with proper headers (CRITICAL: Must use vidsrc-embed.ru as referer!)
    const proRcpResponse = await httpClient.fetch(proRcpUrl, {
      timeout: 10000,
      referer: embedUrl, // MUST be vidsrc-embed.ru, not cloudnestra.com!
      origin: 'https://vidsrc-embed.ru'
    }, requestId);
    
    // For srcrcp, we need to follow another iframe redirect
    let finalPageHtml = proRcpResponse.body;
    
    if (isSrcRcp) {
      console.log('[Superembed] SrcRCP detected, checking for nested iframe...');
      
      // Debug: Save the srcrcp page
      if (typeof Bun !== 'undefined') {
        await Bun.write('superembed-srcrcp-page.html', proRcpResponse.body);
        console.log('[Superembed] Saved srcrcp page to superembed-srcrcp-page.html');
      }
      
      // Look for another srcrcp iframe in the page (jQuery pattern or direct iframe)
      const nestedIframeMatch = proRcpResponse.body.match(/['"]\/srcrcp\/([A-Za-z0-9+\/=\-_]+)['"]/);
      console.log('[Superembed] Nested iframe match:', nestedIframeMatch ? 'FOUND' : 'NOT FOUND');
      
      if (nestedIframeMatch) {
        const nestedHash = nestedIframeMatch[1];
        console.log('[Superembed] Found nested srcrcp iframe:', nestedHash.substring(0, 20) + '...');
        
        // Fetch the nested srcrcp page
        const nestedUrl = `https://cloudnestra.com/srcrcp/${nestedHash}`;
        const nestedResponse = await httpClient.fetch(nestedUrl, {
          timeout: 10000,
          referer: proRcpUrl,
          origin: 'https://vidsrc-embed.ru'
        }, requestId);
        
        finalPageHtml = nestedResponse.body;
        console.log('[Superembed] Fetched nested srcrcp page');
      }
    }
    
    // Extract hidden div using regex
    const hiddenDivMatch = finalPageHtml.match(/<div[^>]+id="([^"]+)"[^>]+style="display:none;">([^<]+)<\/div>/);
    if (!hiddenDivMatch) {
      throw new Error('No hidden div found in final page');
    }
    
    const hiddenDiv = {
      divId: hiddenDivMatch[1],
      encoded: hiddenDivMatch[2]
    };
    
    console.log('[Superembed] Extracted hidden div:', hiddenDiv.divId);
    
    // Step 5: Decode the hidden div content using ULTIMATE DECODER (100% coverage)
    console.log('[Superembed] Using Ultimate Decoder (100% coverage)');
    const { decodeWithCache } = await import('./rcp/ultimate-decoder');
    
    const ultimateResult = decodeWithCache(
      hiddenDiv.encoded,
      hiddenDiv.divId,
      '' // dataI not needed
    );
    
    let decoderResult;
    
    if (ultimateResult.success && ultimateResult.url) {
      console.log('[Superembed] ✅ Ultimate Decoder SUCCESS with method:', ultimateResult.method);
      decoderResult = {
        url: ultimateResult.url,
        method: ultimateResult.method || 'ultimate-decoder',
        urls: [ultimateResult.url]
      };
    } else {
      // Fallback to legacy decoders
      console.log('[Superembed] Ultimate decoder failed, trying legacy decoders...');
      decoderResult = await tryAllDecoders(
        hiddenDiv.encoded,
        hiddenDiv.divId,
        requestId
      );
      
      if (!decoderResult) {
        // Final fallback: Try Puppeteer decoder (slow but works for new encodings)
        console.log('[Superembed] All static decoders failed, trying Puppeteer decoder...');
        try {
          const { decode: decodeWithPuppeteer } = await import('./rcp/puppeteer-decoder');
          const puppeteerUrl = await decodeWithPuppeteer(hiddenDiv.encoded, hiddenDiv.divId, '');
          
          if (puppeteerUrl && typeof puppeteerUrl === 'string' && puppeteerUrl.length > 0) {
            console.log('[Superembed] ✅ Puppeteer decoder SUCCESS');
            decoderResult = {
              url: puppeteerUrl,
              method: 'puppeteer-live-decoder',
              urls: [puppeteerUrl]
            };
          } else {
            throw new Error(`The stream provider has updated their encoding method. All 36+ decoder methods failed. This title is temporarily unavailable until the new encoding is reverse-engineered. Please try a different title.`);
          }
        } catch (puppeteerError) {
          console.error('[Superembed] Puppeteer decoder also failed:', puppeteerError);
          throw new Error(`The stream provider has updated their encoding method. All decoder methods (including Puppeteer) failed. This title is temporarily unavailable.`);
        }
      }
    }
    
    console.log('[Superembed] Decoded successfully with method:', decoderResult.method);
    
    // Step 6: Clean decoded URL (remove " or " separators if present)
    let cleanUrl = decoderResult.url;
    if (cleanUrl.includes(' or ')) {
      const urlParts = cleanUrl.split(' or ');
      cleanUrl = urlParts[0].trim();
      console.log('[Superembed] Found multiple URLs separated by " or ", using first:', cleanUrl.substring(0, 100));
    }
    
    // Step 7: Resolve placeholders
    const urls = resolvePlaceholders(cleanUrl, requestId);
    
    if (urls.length === 0) {
      throw new Error('No valid URLs after placeholder resolution');
    }
    
    console.log('[Superembed] Extraction complete, found', urls.length, 'URLs');
    
    return {
      success: true,
      url: urls[0],
      urls,
      provider: 'superembed'
    };
    
  } catch (error) {
    console.error('[Superembed] Extraction failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: 'superembed'
    };
  }
}
