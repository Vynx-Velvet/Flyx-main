import { NextResponse } from 'next/server';

/**
 * Shadowlands Direct Extraction API
 * Uses simple HTTP requests (like Insomnia) to extract streaming URLs
 * Chain: VidSrc → CloudNestra → ProRCP → Shadowlands
 */

// VERCEL-COMPATIBLE logger - uses console.error for visibility
function createLogger(requestId) {
  const log = (...args) => console.error(...args);
  return {
    info: (message, data = {}) => {
      const timestamp = new Date().toISOString();
      log(`[${timestamp}] [${requestId}] INFO: ${message}`, JSON.stringify(data, null, 2));
    },
    warn: (message, data = {}) => {
      const timestamp = new Date().toISOString();
      log(`[${timestamp}] [${requestId}] WARN: ${message}`, JSON.stringify(data, null, 2));
    },
    error: (message, error = null, data = {}) => {
      const timestamp = new Date().toISOString();
      log(`[${timestamp}] [${requestId}] ERROR: ${message}`, JSON.stringify({
        error: error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
          cause: error.cause
        } : null,
        ...data
      }, null, 2));
    },
    debug: (message, data = {}) => {
      const timestamp = new Date().toISOString();
      log(`[${timestamp}] [${requestId}] DEBUG: ${message}`, JSON.stringify(data, null, 2));
    },
    step: (stepNumber, stepName, data = {}) => {
      const timestamp = new Date().toISOString();
      log(`[${timestamp}] [${requestId}] STEP ${stepNumber}: ${stepName}`, JSON.stringify(data, null, 2));
    }
  };
}

// Generate unique request ID
function generateRequestId() {
  return `shadowlands_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Extract CloudNestra URL from VidSrc HTML with enhanced debugging
function extractCloudNestraUrl(html, logger) {
  logger.debug('Starting CloudNestra URL extraction', {
    htmlLength: html.length,
    containsCloudnestra: html.includes('cloudnestra'),
    containsIframe: html.includes('iframe'),
    containsRcp: html.includes('rcp')
  });
  
  const patterns = [
    /<iframe[^>]*src\s*=\s*["']([^"']*cloudnestra\.com\/rcp[^"']*)["'][^>]*>/gi,
    /src\s*=\s*["']([^"']*cloudnestra\.com\/rcp[^\s"']*)/gi,
    /https:\/\/cloudnestra\.com\/rcp\/[^\s"'>]*/gi,
    /["'](https:\/\/cloudnestra\.com\/rcp\/[^"']*)["']/gi,
    /\/\/cloudnestra\.com\/rcp\/[^\s"'>]*/gi
  ];

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    logger.debug(`Testing pattern ${i + 1}`, { pattern: pattern.toString() });
    
    const matches = html.match(pattern);
    if (matches) {
      logger.debug(`Pattern ${i + 1} found ${matches.length} matches`, { 
        matches: matches.slice(0, 3) // Log first 3 matches
      });
      
      for (const match of matches) {
        let url = match;
        
        if (match.includes('<iframe')) {
          const srcMatch = match.match(/src\s*=\s*["']([^"']*)["']/i);
          if (srcMatch && srcMatch[1]) {
            url = srcMatch[1];
          }
        } else if (match.match(/^["'][^]*["']$/)) {
          url = match.substring(1, match.length - 1);
        }
        
        url = url.trim();
        
        if (url.includes('cloudnestra.com/rcp')) {
          if (url.startsWith('//')) {
            url = `https:${url}`;
          } else if (!url.startsWith('http')) {
            url = `https://${url}`;
          }
          
          const urlEndIndex = url.search(/(%3E|>|%20|\s)/);
          if (urlEndIndex > 0) {
            url = url.substring(0, urlEndIndex);
          }
          
          logger.info('CloudNestra URL extracted successfully', { 
            url,
            patternUsed: i + 1,
            originalMatch: match.substring(0, 100) + '...'
          });
          return url;
        }
      }
    } else {
      logger.debug(`Pattern ${i + 1} found no matches`);
    }
  }
  
  // Additional debugging for failure case
  logger.error('CloudNestra URL extraction failed', null, {
    htmlContainsCloudnestra: html.includes('cloudnestra'),
    htmlContainsRcp: html.includes('rcp'),
    htmlContainsIframe: html.includes('iframe'),
    htmlSample: html.substring(0, 1000) + '...',
    patternsAttempted: patterns.length
  });
  
  return null;
}

// Extract ProRCP URL from CloudNestra HTML
function extractProRcpUrl(html, logger) {
  logger.info('Extracting ProRCP URL from CloudNestra HTML...');
  
  const patterns = [
    // jQuery iframe creation with src: '/prorcp/...'
    /\$\(['"]<iframe['"]\s*,\s*\{[^}]*src:\s*['"]([^'"]*prorcp[^'"]+)['"]/gi,
    /src:\s*['"]\/prorcp\/([^'"]+)['"]/gi,
    /src:\s*['"]([^'"]*\/prorcp\/[^'"]+)['"]/gi,
    
    // Direct iframe tags
    /<iframe[^>]*src\s*=\s*["']([^"']*prorcp[^"']*)["'][^>]*>/gi,
    /iframe\.src\s*=\s*["']([^"']*prorcp[^'"]*)['"]/gi,
    
    // Generic patterns for ProRCP URLs
    /\/prorcp\/[A-Za-z0-9+\/=]+/g,
    /['"]\/prorcp\/([^'"]+)['"]/g,
    /["']([^'"]*prorcp[^'"]+)['"]/g
  ];

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const matches = html.match(pattern);
    
    if (matches && matches.length > 0) {
      logger.info(`Pattern ${i + 1} found ${matches.length} match(es)`);
      
      for (const match of matches) {
        let url = match;
        
        // Extract from jQuery iframe syntax
        if (match.includes('$') || match.includes('src:')) {
          const srcMatch = match.match(/src:\s*['"]([^'"]+)['"]/i);
          if (srcMatch && srcMatch[1]) {
            url = srcMatch[1];
          }
        }
        // Extract from iframe tag
        else if (match.includes('<iframe')) {
          const srcMatch = match.match(/src\s*=\s*["']([^"']*)["']/i);
          if (srcMatch && srcMatch[1]) {
            url = srcMatch[1];
          }
        }
        // Remove quotes if present
        else if (match.match(/^["'][^]*["']$/)) {
          url = match.substring(1, match.length - 1);
        }
        
        url = url.trim();
        
        // Check if it's a ProRCP URL
        if (url.includes('prorcp')) {
          // Clean up the URL
          if (!url.startsWith('/') && !url.startsWith('http')) {
            url = '/' + url;
          }
          
          logger.info('Found ProRCP path', { url: url.substring(0, 50) + '...' });
          return url;
        }
      }
    }
  }
  
  logger.error('ProRCP URL not found in CloudNestra HTML');
  return null;
}

// Replace server placeholders with actual server names
function replacePlaceholders(url, logger) {
  const originalUrl = url;
  
  // Common shadowlands server replacements
  const serverReplacements = {
    '{v1}': 'shadowlandschronicles.com',
    '{v2}': 'shadowlandschronicles.com', 
    '{v3}': 'shadowlandschronicles.com',
    '{v4}': 'shadowlandschronicles.com',
    '{v5}': 'shadowlandschronicles.com'
  };
  
  // Replace placeholders
  for (const [placeholder, replacement] of Object.entries(serverReplacements)) {
    if (url.includes(placeholder)) {
      url = url.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), replacement);
      logger.info('Replaced server placeholder', { 
        placeholder, 
        replacement,
        before: originalUrl.substring(0, 100) + '...',
        after: url.substring(0, 100) + '...'
      });
    }
  }
  
  return url;
}

// Extract Shadowlands URL from ProRCP HTML
function extractShadowlandsUrl(html, logger) {
  logger.info('Extracting Shadowlands URL from ProRCP HTML...');
  
  // First, log a sample of the HTML to see what we're working with
  logger.debug('ProRCP HTML sample for analysis', {
    htmlLength: html.length,
    containsPlayerjs: html.includes('Playerjs'),
    containsFile: html.includes('file:'),
    containsShadowlands: html.includes('shadowlands'),
    containsTmstr: html.includes('tmstr'),
    containsM3u8: html.includes('.m3u8'),
    containsPutgate: html.includes('putgate'),
    htmlSample1: html.substring(html.indexOf('file:') - 100, html.indexOf('file:') + 200) || 'file: not found',
    htmlSample2: html.substring(html.indexOf('.m3u8') - 100, html.indexOf('.m3u8') + 200) || '.m3u8 not found',
    htmlSample3: html.substring(html.indexOf('putgate') - 100, html.indexOf('putgate') + 200) || 'putgate not found'
  });
  
  // Check if the file parameter is empty (dynamic loading)
  if (html.includes('file:""') || html.includes("file:''")) {
    logger.warn('Detected empty file parameter - URL is loaded dynamically', {
      hasPutgate: html.includes('putgate'),
      hasPerformanceObserver: html.includes('PerformanceObserver'),
      suggestion: 'Need to extract from dynamic loading code or fetch the actual stream URL'
    });
  }
  
  const patterns = [
    // Dynamic URL construction patterns (for putgate/tmstr URLs)
    /new_pass_obj\s*=\s*new\s+URL\s*\(\s*['"]([^'"]+\.m3u8[^'"]*)['"]/gi,
    /entry\.name[^\n]*['"]([^'"]+\.m3u8[^'"]*)['"]/gi,
    
    // Playerjs file parameter - most common pattern
    /new\s+Playerjs\s*\([^)]*file\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/gi,
    /\bfile\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/gi,
    
    // Direct URLs with full protocol (tmstr, putgate, shadowlands)
    /https?:\/\/[^\s"'<>]*(?:tmstr|putgate|shadowlands)[^\s"'<>]*\.m3u8[^\s"'<>]*/gi,
    /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi,
    
    // Player configurations
    /player[^{]*\{[^}]*file\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/gi,
    /source\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/gi,
    /src\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/gi,
    
    // Quoted URLs (but must have more than just .m3u8)
    /['"]([^'"]{20,}\.m3u8[^'"]*)['"]/gi
  ];

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const matches = html.match(pattern);
    
    if (matches && matches.length > 0) {
      logger.info(`Pattern ${i + 1} found ${matches.length} match(es)`);
      
      for (const match of matches) {
        let url = match;
        
        // Extract URL from Playerjs syntax
        if (match.includes('Playerjs') || match.includes('file')) {
          const fileMatch = match.match(/file\s*:\s*['"]([^'"]+)['"]/i);
          if (fileMatch && fileMatch[1]) {
            url = fileMatch[1];
          }
        }
        // Extract URL from source/src
        else if (match.includes('source') || match.includes('src')) {
          const srcMatch = match.match(/(?:source|src)\s*:\s*['"]([^'"]+)['"]/i);
          if (srcMatch && srcMatch[1]) {
            url = srcMatch[1];
          }
        }
        // Remove quotes if present
        else if (match.match(/^["'][^]*["']$/)) {
          url = match.substring(1, match.length - 1);
        }
        
        url = url.trim();
        
        // Skip if URL is too short (likely just ".m3u8" or similar)
        if (url.length < 20) {
          logger.debug('Skipping too-short URL match', {
            rawMatch: match.substring(0, 50),
            extractedUrl: url,
            urlLength: url.length,
            reason: 'URL too short, likely incomplete'
          });
          continue;
        }
        
        logger.debug('Processing potential URL match', {
          rawMatch: match.substring(0, 150),
          extractedUrl: url.substring(0, 150),
          urlLength: url.length,
          hasM3u8: url.includes('.m3u8'),
          hasProtocol: url.startsWith('http'),
          patternIndex: i + 1
        });
        
        // Check if it's a valid stream URL
        if (url.includes('.m3u8')) {
          // Handle multiple URLs separated by " or "
          if (url.includes(' or ')) {
            const urls = url.split(' or ').map(u => u.trim());
            logger.info('Found multiple URLs, selecting first valid one', { 
              count: urls.length,
              urls: urls.map(u => u.substring(0, 60) + '...')
            });
            url = urls[0]; // Take the first URL
          }
          
          // Ensure it's a full URL
          if (!url.startsWith('http')) {
            if (url.startsWith('//')) {
              url = `https:${url}`;
            } else if (url.startsWith('/')) {
              url = `https://tmstr2.shadowlandschronicles.com${url}`;
            } else {
              url = `https://${url}`;
            }
          }
          
          // Replace server placeholders with actual server names
          url = replacePlaceholders(url, logger);
          
          // Check if URL contains dots that might be encoding artifacts
          if (url.includes('/.') && !url.includes('/.well-known')) {
            logger.warn('URL contains suspicious dots - may be encoded', {
              url: url.substring(0, 150),
              dotCount: (url.match(/\./g) || []).length,
              hasSuspiciousDots: url.match(/\/[A-Za-z0-9]+\.[A-Za-z0-9]+\./g)
            });
          }
          
          // CRITICAL VALIDATION - ensure URL is complete
          if (!url.includes('://') || url.match(/https?:\/\/\./) || url.length < 30) {
            logger.error('MALFORMED URL DETECTED AFTER EXTRACTION', null, {
              extractedUrl: url,
              urlLength: url.length,
              hasProtocol: url.includes('://'),
              hasEmptyHost: url.match(/https?:\/\/\./),
              originalMatch: match.substring(0, 200)
            });
            continue; // Skip this match and try the next one
          }
          
          logger.info('Selected Shadowlands URL', { 
            url: url.substring(0, 100) + '...',
            urlLength: url.length,
            urlValid: true
          });
          return url;
        }
      }
    }
  }
  
  logger.error('Shadowlands URL not found in ProRCP HTML');
  return null;
}

// Main extraction function with enhanced debugging
async function extractShadowlandsChain(tmdbId, season, episode, requestId) {
  const logger = createLogger(requestId);
  const startTime = Date.now();
  
  try {
    // Build VidSrc URL
    let vidsrcUrl;
    if (season && episode) {
      vidsrcUrl = `https://vidsrc.xyz/embed/tv/${tmdbId}/${season}/${episode}`;
    } else {
      vidsrcUrl = `https://vidsrc.xyz/embed/movie/${tmdbId}`;
    }
    
    logger.info('Starting extraction chain', { 
      vidsrcUrl, 
      tmdbId, 
      season, 
      episode,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    
    // Step 1: Fetch VidSrc with detailed logging
    logger.step(1, 'Fetching VidSrc page', { url: vidsrcUrl });
    
    const vidsrcStartTime = Date.now();
    let vidsrcResponse;
    
    try {
      vidsrcResponse = await fetch(vidsrcUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      const vidsrcDuration = Date.now() - vidsrcStartTime;
      logger.debug('VidSrc fetch completed', { 
        status: vidsrcResponse.status,
        statusText: vidsrcResponse.statusText,
        duration: vidsrcDuration,
        headers: Object.fromEntries(vidsrcResponse.headers.entries())
      });
      
    } catch (fetchError) {
      const vidsrcDuration = Date.now() - vidsrcStartTime;
      logger.error('VidSrc fetch failed', fetchError, { 
        duration: vidsrcDuration,
        url: vidsrcUrl
      });
      throw new Error(`VidSrc fetch failed: ${fetchError.message}`);
    }
    
    if (!vidsrcResponse.ok) {
      logger.error('VidSrc returned error status', null, {
        status: vidsrcResponse.status,
        statusText: vidsrcResponse.statusText,
        headers: Object.fromEntries(vidsrcResponse.headers.entries())
      });
      throw new Error(`VidSrc returned ${vidsrcResponse.status}: ${vidsrcResponse.statusText}`);
    }
    
    let vidsrcHtml;
    try {
      vidsrcHtml = await vidsrcResponse.text();
      logger.info('VidSrc HTML received', { 
        bytes: vidsrcHtml.length,
        contentType: vidsrcResponse.headers.get('content-type'),
        preview: vidsrcHtml.substring(0, 200) + '...'
      });
    } catch (textError) {
      logger.error('Failed to read VidSrc response text', textError);
      throw new Error(`Failed to read VidSrc response: ${textError.message}`);
    }
    
    // Step 2: Extract CloudNestra URL with detailed logging
    logger.step(2, 'Extracting CloudNestra URL from VidSrc HTML');
    const cloudNestraUrl = extractCloudNestraUrl(vidsrcHtml, logger);
    
    if (!cloudNestraUrl) {
      logger.error('CloudNestra URL extraction failed', null, {
        htmlLength: vidsrcHtml.length,
        htmlPreview: vidsrcHtml.substring(0, 500),
        searchPatterns: [
          'cloudnestra.com/rcp',
          'iframe',
          'src='
        ]
      });
      throw new Error('CloudNestra URL not found in VidSrc HTML');
    }
    
    // Step 3: Fetch CloudNestra with detailed logging
    logger.step(3, 'Fetching CloudNestra page', { url: cloudNestraUrl });
    
    const cloudNestraStartTime = Date.now();
    let cloudNestraResponse;
    
    try {
      cloudNestraResponse = await fetch(cloudNestraUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Referer': vidsrcUrl
        }
      });
      
      const cloudNestraDuration = Date.now() - cloudNestraStartTime;
      logger.debug('CloudNestra fetch completed', { 
        status: cloudNestraResponse.status,
        statusText: cloudNestraResponse.statusText,
        duration: cloudNestraDuration,
        headers: Object.fromEntries(cloudNestraResponse.headers.entries())
      });
      
    } catch (fetchError) {
      const cloudNestraDuration = Date.now() - cloudNestraStartTime;
      logger.error('CloudNestra fetch failed', fetchError, { 
        duration: cloudNestraDuration,
        url: cloudNestraUrl
      });
      throw new Error(`CloudNestra fetch failed: ${fetchError.message}`);
    }
    
    if (!cloudNestraResponse.ok) {
      logger.error('CloudNestra returned error status', null, {
        status: cloudNestraResponse.status,
        statusText: cloudNestraResponse.statusText,
        headers: Object.fromEntries(cloudNestraResponse.headers.entries())
      });
      throw new Error(`CloudNestra returned ${cloudNestraResponse.status}: ${cloudNestraResponse.statusText}`);
    }
    
    let cloudNestraHtml;
    try {
      cloudNestraHtml = await cloudNestraResponse.text();
      logger.info('CloudNestra HTML received', { 
        bytes: cloudNestraHtml.length,
        contentType: cloudNestraResponse.headers.get('content-type'),
        preview: cloudNestraHtml.substring(0, 200) + '...'
      });
    } catch (textError) {
      logger.error('Failed to read CloudNestra response text', textError);
      throw new Error(`Failed to read CloudNestra response: ${textError.message}`);
    }
    
    // Step 4: Extract ProRCP URL with detailed logging
    logger.step(4, 'Extracting ProRCP URL from CloudNestra HTML');
    const proRcpPath = extractProRcpUrl(cloudNestraHtml, logger);
    
    if (!proRcpPath) {
      logger.error('ProRCP URL extraction failed', null, {
        htmlLength: cloudNestraHtml.length,
        htmlPreview: cloudNestraHtml.substring(0, 500),
        searchPatterns: [
          'prorcp',
          'iframe',
          'src:',
          'jQuery'
        ]
      });
      throw new Error('ProRCP URL not found in CloudNestra HTML');
    }
    
    const proRcpUrl = proRcpPath.startsWith('http') 
      ? proRcpPath 
      : `https://cloudnestra.com${proRcpPath}`;
    
    logger.debug('ProRCP URL constructed', { 
      originalPath: proRcpPath,
      finalUrl: proRcpUrl
    });
    
    // Step 5: Fetch ProRCP with detailed logging
    logger.step(5, 'Fetching ProRCP page', { url: proRcpUrl });
    
    const proRcpStartTime = Date.now();
    let proRcpResponse;
    
    try {
      proRcpResponse = await fetch(proRcpUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Referer': cloudNestraUrl
        }
      });
      
      const proRcpDuration = Date.now() - proRcpStartTime;
      logger.debug('ProRCP fetch completed', { 
        status: proRcpResponse.status,
        statusText: proRcpResponse.statusText,
        duration: proRcpDuration,
        headers: Object.fromEntries(proRcpResponse.headers.entries())
      });
      
    } catch (fetchError) {
      const proRcpDuration = Date.now() - proRcpStartTime;
      logger.error('ProRCP fetch failed', fetchError, { 
        duration: proRcpDuration,
        url: proRcpUrl
      });
      throw new Error(`ProRCP fetch failed: ${fetchError.message}`);
    }
    
    if (!proRcpResponse.ok) {
      logger.error('ProRCP returned error status', null, {
        status: proRcpResponse.status,
        statusText: proRcpResponse.statusText,
        headers: Object.fromEntries(proRcpResponse.headers.entries())
      });
      throw new Error(`ProRCP returned ${proRcpResponse.status}: ${proRcpResponse.statusText}`);
    }
    
    let proRcpHtml;
    try {
      proRcpHtml = await proRcpResponse.text();
      logger.info('ProRCP HTML received', { 
        bytes: proRcpHtml.length,
        contentType: proRcpResponse.headers.get('content-type'),
        preview: proRcpHtml.substring(0, 200) + '...'
      });
    } catch (textError) {
      logger.error('Failed to read ProRCP response text', textError);
      throw new Error(`Failed to read ProRCP response: ${textError.message}`);
    }
    
    // Step 6: Extract Shadowlands URL with detailed logging
    logger.step(6, 'Extracting Shadowlands URL from ProRCP HTML');
    const shadowlandsUrl = extractShadowlandsUrl(proRcpHtml, logger);
    
    if (!shadowlandsUrl) {
      logger.error('Shadowlands URL extraction failed', null, {
        htmlLength: proRcpHtml.length,
        htmlPreview: proRcpHtml.substring(0, 500),
        searchPatterns: [
          'shadowlands',
          '.m3u8',
          'Playerjs',
          'file:',
          'source:'
        ]
      });
      throw new Error('Shadowlands URL not found in ProRCP HTML');
    }
    
    // Validate the extracted URL
    logger.debug('Shadowlands URL validation', {
      url: shadowlandsUrl,
      isValidUrl: shadowlandsUrl.startsWith('http'),
      containsM3u8: shadowlandsUrl.includes('.m3u8'),
      containsShadowlands: shadowlandsUrl.includes('shadowlands')
    });
    
    const duration = Date.now() - startTime;
    logger.info('Extraction chain completed successfully', { 
      totalDuration: duration,
      shadowlandsUrl: shadowlandsUrl.substring(0, 100) + '...',
      steps: 6
    });
    
    const result = {
      success: true,
      streamUrl: shadowlandsUrl,
      streamType: 'hls',
      server: 'shadowlands',
      extractionMethod: 'direct_http',
      requiresProxy: true,
      chain: {
        vidsrc: vidsrcUrl,
        cloudnestra: cloudNestraUrl,
        prorcp: proRcpUrl,
        shadowlands: shadowlandsUrl
      },
      metadata: {
        tmdbId,
        season,
        episode,
        duration,
        requestId,
        timestamp: new Date().toISOString()
      }
    };
    
    logger.debug('Final result', { 
      success: result.success,
      streamType: result.streamType,
      server: result.server,
      requiresProxy: result.requiresProxy
    });
    
    return result;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Extraction chain failed', error, { 
      totalDuration: duration,
      failurePoint: error.message,
      tmdbId,
      season,
      episode
    });
    
    // Re-throw with enhanced error information
    const enhancedError = new Error(`Extraction failed after ${duration}ms: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.duration = duration;
    enhancedError.requestId = requestId;
    throw enhancedError;
  }
}

// GET handler with enhanced debugging
export async function GET(request) {
  const requestId = generateRequestId();
  const logger = createLogger(requestId);
  const startTime = Date.now();
  
  try {
    // Log request details
    logger.info('=== EXTRACTION REQUEST STARTED ===', {
      requestId,
      timestamp: new Date().toISOString(),
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries())
    });
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const tmdbId = searchParams.get('tmdbId') || searchParams.get('movieId');
    const season = searchParams.get('season') || searchParams.get('seasonId');
    const episode = searchParams.get('episode') || searchParams.get('episodeId');
    
    // Log all parameters
    logger.debug('Request parameters parsed', {
      tmdbId,
      season,
      episode,
      allParams: Object.fromEntries(searchParams.entries())
    });
    
    // Validate required parameters
    if (!tmdbId) {
      logger.warn('Missing required parameter', { 
        provided: Object.fromEntries(searchParams.entries()),
        required: ['tmdbId', 'movieId']
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: tmdbId or movieId',
          requestId,
          providedParams: Object.fromEntries(searchParams.entries())
        },
        { status: 400 }
      );
    }
    
    // Determine content type
    const contentType = (season && episode) ? 'tv' : 'movie';
    logger.info('Content type determined', {
      contentType,
      tmdbId,
      season,
      episode
    });
    
    // Perform extraction with timeout
    logger.info('Starting extraction process...');
    const extractionStartTime = Date.now();
    
    const result = await Promise.race([
      extractShadowlandsChain(tmdbId, season, episode, requestId),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Extraction timeout after 60 seconds')), 60000)
      )
    ]);
    
    const extractionDuration = Date.now() - extractionStartTime;
    logger.info('Extraction completed successfully', {
      duration: extractionDuration,
      resultKeys: Object.keys(result)
    });
    
    // Add response metadata
    const response = {
      ...result,
      metadata: {
        ...result.metadata,
        extractionDuration,
        totalDuration: Date.now() - startTime,
        contentType,
        serverTimestamp: new Date().toISOString()
      }
    };
    
    logger.info('=== EXTRACTION REQUEST COMPLETED ===', {
      success: true,
      duration: Date.now() - startTime
    });
    
    return NextResponse.json(response, {
      headers: {
        'X-Request-ID': requestId,
        'X-Extraction-Duration': extractionDuration.toString(),
        'X-Content-Type': contentType
      }
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Determine error type and status code
    let statusCode = 500;
    let errorType = 'INTERNAL_ERROR';
    
    if (error.message.includes('timeout')) {
      statusCode = 504;
      errorType = 'TIMEOUT_ERROR';
    } else if (error.message.includes('fetch failed') || error.message.includes('network')) {
      statusCode = 503;
      errorType = 'NETWORK_ERROR';
    } else if (error.message.includes('not found')) {
      statusCode = 404;
      errorType = 'EXTRACTION_ERROR';
    }
    
    logger.error('=== EXTRACTION REQUEST FAILED ===', error, { 
      duration,
      errorType,
      statusCode,
      originalMessage: error.message,
      stack: error.stack
    });
    
    const errorResponse = {
      success: false,
      error: error.message,
      errorType,
      requestId,
      duration,
      timestamp: new Date().toISOString(),
      debug: {
        originalError: error.originalError?.message,
        failurePoint: error.message,
        requestDuration: duration
      }
    };
    
    return NextResponse.json(errorResponse, { 
      status: statusCode,
      headers: {
        'X-Request-ID': requestId,
        'X-Error-Type': errorType,
        'X-Request-Duration': duration.toString()
      }
    });
  }
}

// OPTIONS handler for CORS
export async function OPTIONS(request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}