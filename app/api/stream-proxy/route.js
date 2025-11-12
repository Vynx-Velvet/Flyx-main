import { NextResponse } from 'next/server';

// Enhanced rate limiting store (in-memory for simplicity)
const rateLimitStore = new Map();
const connectionPool = new Map();

// VERCEL-COMPATIBLE logger - uses console.error for everything to ensure logs appear
function createLogger(requestId) {
  const timestamp = () => new Date().toISOString();
  const log = (...args) => console.error(...args); // Vercel shows stderr better
  
  return {
    info: (message, data = {}) => {
      log(`[${timestamp()}] [${requestId}] INFO: ${message}`);
      if (Object.keys(data).length > 0) {
        log('DATA:', JSON.stringify(data, null, 2));
      }
    },
    warn: (message, data = {}) => {
      log(`[${timestamp()}] [${requestId}] WARN: ${message}`);
      if (Object.keys(data).length > 0) {
        log('DATA:', JSON.stringify(data, null, 2));
      }
    },
    error: (message, error = null, data = {}) => {
      log(`[${timestamp()}] [${requestId}] ERROR: ${message}`);
      if (error) {
        log('ERROR DETAILS:', {
          name: error.name,
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 10).join('\n'),
          cause: error.cause,
          code: error.code
        });
      }
      if (Object.keys(data).length > 0) {
        log('ADDITIONAL DATA:', JSON.stringify(data, null, 2));
      }
    },
    debug: (message, data = {}) => {
      log(`[${timestamp()}] [${requestId}] DEBUG: ${message}`);
      if (Object.keys(data).length > 0) {
        log('DEBUG DATA:', JSON.stringify(data, null, 2));
      }
    },
    timing: (label, startTime) => {
      const duration = Date.now() - startTime;
      log(`[${timestamp()}] [${requestId}] TIMING: ${label} took ${duration}ms`);
      return duration;
    },
    request: (method, url, headers = {}) => {
      log(`[${timestamp()}] [${requestId}] ${method} REQUEST: ${url}`);
      log('HEADERS:', JSON.stringify(headers, null, 2));
    },
    response: (status, headers = {}, contentPreview = '') => {
      log(`[${timestamp()}] [${requestId}] RESPONSE: ${status}`);
      log('RESPONSE HEADERS:', JSON.stringify(headers, null, 2));
      if (contentPreview) {
        log('CONTENT PREVIEW:', contentPreview.substring(0, 200));
      }
    },
    success: (message, data = {}) => {
      log(`[${timestamp()}] [${requestId}] SUCCESS: ${message}`);
      if (Object.keys(data).length > 0) {
        log('SUCCESS DATA:', JSON.stringify(data, null, 2));
      }
    },
    step: (stepNumber, stepName, data = {}) => {
      log(`[${timestamp()}] [${requestId}] STEP ${stepNumber}: ${stepName}`);
      if (Object.keys(data).length > 0) {
        log('STEP DATA:', JSON.stringify(data, null, 2));
      }
    },
    memory: () => {
      try {
        const usage = process.memoryUsage();
        log(`[${timestamp()}] [${requestId}] MEMORY: RSS=${Math.round(usage.rss / 1024 / 1024)}MB Heap=${Math.round(usage.heapUsed / 1024 / 1024)}MB`);
      } catch (e) {
        // Memory info not available
      }
    }
  };
}



// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: 1000, // Increased to 1000 requests per minute per IP
  blockDuration: 5 * 60 * 1000, // Block for 5 minutes if exceeded
  lightningboltMaxRequests: 2000 // Special higher limit for lightningbolt URLs
};

// STABLE Retry configuration - patient and non-aggressive
const RETRY_CONFIG = {
  maxRetries: 1,         // Only 1 retry to avoid interruptions
  baseDelay: 3000,       // 3 seconds base delay
  maxDelay: 5000,        // 5 seconds max delay
  backoffFactor: 1       // No exponential backoff
};

// STABLE Connection configuration - longer timeouts for stability
const CONNECTION_POOL_CONFIG = {
  maxConnections: 100,
  keepAliveTimeout: 60000,  // 60 seconds keepalive
  timeout: 60000            // 60 seconds request timeout for patience
};

// Generate unique request ID (simplified)
function generateRequestId() {
  return `proxy_${Date.now()}`;
}

// Startup logging (after all configs are defined) - using console.error for Vercel
console.error('='.repeat(80));
console.error('STREAM-PROXY ROUTE LOADED AT:', new Date().toISOString());
console.error('RATE LIMIT CONFIG:', JSON.stringify({
  windowMs: RATE_LIMIT_CONFIG.windowMs,
  maxRequests: RATE_LIMIT_CONFIG.maxRequests,
  blockDuration: RATE_LIMIT_CONFIG.blockDuration
}));
console.error('RETRY CONFIG:', JSON.stringify({
  maxRetries: RETRY_CONFIG.maxRetries,
  baseDelay: RETRY_CONFIG.baseDelay
}));
console.error('CONNECTION CONFIG:', JSON.stringify({
  maxConnections: CONNECTION_POOL_CONFIG.maxConnections,
  timeout: CONNECTION_POOL_CONFIG.timeout
}));
console.error('='.repeat(80));

// Enhanced rate limiting
function checkRateLimit(clientIp, logger, isLightningbolt = false) {
  const now = Date.now();
  const clientKey = `rate_${clientIp}`;
  
  // Determine the appropriate rate limit based on URL type
  const maxRequests = isLightningbolt ?
    RATE_LIMIT_CONFIG.lightningboltMaxRequests :
    RATE_LIMIT_CONFIG.maxRequests;
  
  if (!rateLimitStore.has(clientKey)) {
    rateLimitStore.set(clientKey, {
      requests: 1,
      windowStart: now,
      blocked: false,
      blockUntil: 0
    });
    return { allowed: true, remaining: maxRequests - 1 };
  }
  
  const clientData = rateLimitStore.get(clientKey);
  
  // Check if client is currently blocked
  if (clientData.blocked && now < clientData.blockUntil) {
    logger.warn('Rate limit blocked request', {
      clientIp,
      blockedUntil: new Date(clientData.blockUntil).toISOString(),
      remainingBlockTime: clientData.blockUntil - now
    });
    return {
      allowed: false,
      blocked: true,
      retryAfter: Math.ceil((clientData.blockUntil - now) / 1000)
    };
  }
  
  // Reset window if expired
  if (now - clientData.windowStart > RATE_LIMIT_CONFIG.windowMs) {
    clientData.requests = 1;
    clientData.windowStart = now;
    clientData.blocked = false;
    clientData.blockUntil = 0;
    return { allowed: true, remaining: maxRequests - 1 };
  }
  
  // Check if limit exceeded
  if (clientData.requests >= maxRequests) {
    clientData.blocked = true;
    clientData.blockUntil = now + RATE_LIMIT_CONFIG.blockDuration;
    logger.warn('Rate limit exceeded', {
      clientIp,
      requests: clientData.requests,
      windowStart: new Date(clientData.windowStart).toISOString(),
      blockedUntil: new Date(clientData.blockUntil).toISOString(),
      isLightningbolt
    });
    return {
      allowed: false,
      blocked: true,
      retryAfter: Math.ceil(RATE_LIMIT_CONFIG.blockDuration / 1000)
    };
  }
  
  // Increment request count
  clientData.requests++;
  return {
    allowed: true,
    remaining: maxRequests - clientData.requests
  };
}

// Enhanced request validation
function validateRequest(request, logger) {
  const userAgent = request.headers.get('user-agent');
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  
  // Basic bot detection
  if (!userAgent || userAgent.length < 10) {
    logger.warn('Suspicious request - invalid user agent', { userAgent });
    return { isValid: false, error: 'Invalid user agent' };
  }
  
  // Check for common bot patterns
  const botPatterns = [
    /bot/i, /crawler/i, /spider/i, /scraper/i,
    /curl/i, /wget/i, /python/i, /java/i
  ];
  
  if (botPatterns.some(pattern => pattern.test(userAgent))) {
    logger.warn('Suspicious request - bot detected', { userAgent });
    return { isValid: false, error: 'Automated requests not allowed' };
  }
  
  return { isValid: true };
}

// SIMPLIFIED fetch with minimal retries for stability
async function fetchWithHeaderFallback(url, baseOptions, logger, userAgent, source, strategyIndex = 0, retryCount = 0) {
  // Check if this is a shadowlands URL
  const isShadowlands = source === 'shadowlands' ||
                       source === 'vidsrc' ||  // vidsrc source is used for shadowlands
                       url.includes('shadowlandschronicles') ||
                       url.includes('shadowlands') ||
                       url.includes('tmstr');
  
  let options;
  
  if (isShadowlands) {
    // For shadowlands URLs, fetch directly without any header modifications
    logger.info('Fetching shadowlands URL directly without header modifications', {
      url: url.substring(0, 100)
    });
    
    options = {
      ...baseOptions,
      // Only preserve range header if present, no other headers
      headers: baseOptions.headers?.Range ? { 'Range': baseOptions.headers.Range } : {}
    };
  } else {
    // Use simplified headers for non-shadowlands URLs
    const headers = getSimplifiedHeaders(url, userAgent, source);
    
    options = {
      ...baseOptions,
      headers: {
        ...headers,
        // Preserve range header if present
        ...(baseOptions.headers?.Range && { 'Range': baseOptions.headers.Range })
      }
    };
  }
  
  try {
    console.error('='.repeat(80));
    console.error('MAKING FETCH REQUEST');
    console.error('='.repeat(80));
    
    logger.step(1, 'FETCH PREPARATION', {
      targetUrl: url.substring(0, 150) + (url.length > 150 ? '...' : ''),
      urlLength: url.length,
      retryCount: retryCount,
      isShadowlands: isShadowlands,
      source: source,
      method: options.method || 'GET',
      headersCount: Object.keys(options.headers || {}).length,
      headers: options.headers || {},
      hasTimeout: !!options.signal,
      timeoutMs: options.signal ? CONNECTION_POOL_CONFIG.timeout : 'none',
      keepalive: options.keepalive,
      hasBody: !!options.body,
      redirect: options.redirect || 'follow'
    });
    
    logger.memory();
    
    logger.step(2, 'INITIATING FETCH REQUEST', {
      timestamp: new Date().toISOString(),
      urlHost: new URL(url).hostname,
      urlProtocol: new URL(url).protocol
    });
    
    const fetchStartTime = Date.now();
    const response = await fetch(url, options);
    const fetchDuration = Date.now() - fetchStartTime;
    
    logger.step(3, 'FETCH COMPLETED', {
      duration: `${fetchDuration}ms`,
      timestamp: new Date().toISOString()
    });
    
    console.error('='.repeat(80));
    console.error('FETCH RESPONSE RECEIVED');
    console.error('='.repeat(80));
    
    logger.response(response.status, Object.fromEntries(response.headers.entries()));
    
    const allResponseHeaders = Object.fromEntries(response.headers.entries());
    
    logger.step(4, 'ANALYZING RESPONSE', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      redirected: response.redirected,
      type: response.type,
      url: response.url?.substring(0, 150),
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
      contentEncoding: response.headers.get('content-encoding'),
      transferEncoding: response.headers.get('transfer-encoding'),
      server: response.headers.get('server'),
      cacheControl: response.headers.get('cache-control'),
      acceptRanges: response.headers.get('accept-ranges'),
      contentRange: response.headers.get('content-range'),
      lastModified: response.headers.get('last-modified'),
      etag: response.headers.get('etag'),
      connection: response.headers.get('connection'),
      fetchDuration: `${fetchDuration}ms`,
      totalHeadersCount: Object.keys(allResponseHeaders).length,
      allResponseHeaders: allResponseHeaders
    });
    
    logger.memory();
    
    // If response is successful, return it
    if (response.ok) {
      logger.success('FETCH SUCCESSFUL - RETURNING RESPONSE', {
        status: response.status,
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
        duration: `${fetchDuration}ms`,
        hasBody: !!response.body,
        bodyUsed: response.bodyUsed
      });
      return response;
    }
    
    // Only retry server errors once
    const isRetryableError = response.status >= 500;
    
    console.error('='.repeat(80));
    console.error('FETCH FAILED - ANALYZING ERROR');
    console.error('='.repeat(80));
    
    logger.error('🚨 FETCH FAILED', null, {
      status: response.status,
      statusText: response.statusText,
      url: url.substring(0, 100) + '...',
      isRetryableError,
      retryCount,
      maxRetries: RETRY_CONFIG.maxRetries,
      willRetry: isRetryableError && retryCount < RETRY_CONFIG.maxRetries,
      responseHeaders: Object.fromEntries(response.headers.entries())
    });
    
    if (isRetryableError && retryCount < RETRY_CONFIG.maxRetries) {
      const delay = RETRY_CONFIG.baseDelay;
      
      logger.warn('🔄 SERVER ERROR - ATTEMPTING RETRY', {
        status: response.status,
        statusText: response.statusText,
        delay: `${delay}ms`,
        retryAttempt: retryCount + 1,
        maxRetries: RETRY_CONFIG.maxRetries
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithHeaderFallback(url, baseOptions, logger, userAgent, source, 0, retryCount + 1);
    }
    
    // Don't retry, just return the response
    return response;
    
  } catch (error) {
    console.error('='.repeat(80));
    console.error('FETCH EXCEPTION CAUGHT');
    console.error('='.repeat(80));
    
    logger.error('FETCH EXCEPTION', error, {
      errorName: error.name,
      errorMessage: error.message,
      errorCode: error.code,
      errorCause: error.cause,
      errorStack: error.stack?.split('\n').slice(0, 10).join('\n'),
      url: url.substring(0, 150),
      retryCount: retryCount,
      maxRetries: RETRY_CONFIG.maxRetries,
      willRetry: retryCount < RETRY_CONFIG.maxRetries,
      isTimeout: error.name === 'AbortError' || error.name === 'TimeoutError',
      isNetworkError: error.name === 'TypeError' && error.message.includes('fetch'),
      isDNSError: error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN',
      isConnectionRefused: error.code === 'ECONNREFUSED',
      isConnectionReset: error.code === 'ECONNRESET'
    });
    
    // Single retry for network errors
    if (retryCount < RETRY_CONFIG.maxRetries) {
      const delay = RETRY_CONFIG.baseDelay;
      
      logger.warn('ATTEMPTING RETRY AFTER ERROR', {
        error: error.message,
        errorType: error.name,
        delay: `${delay}ms`,
        retryAttempt: retryCount + 1,
        maxRetries: RETRY_CONFIG.maxRetries
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithHeaderFallback(url, baseOptions, logger, userAgent, source, 0, retryCount + 1);
    }
    
    logger.error('RETRIES EXHAUSTED - THROWING ERROR', error, {
      totalRetries: retryCount,
      maxRetries: RETRY_CONFIG.maxRetries
    });
    
    // Re-throw the error if retries exhausted
    throw error;
  }
}

// SIMPLIFIED headers for non-shadowlands URLs
function getSimplifiedHeaders(url, userAgent, source) {
  const baseUserAgent = userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  
  // Minimal headers for stability
  const headers = {
    'User-Agent': baseUserAgent,
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive'
  };
  
  // Add Origin/Referer for specific non-shadowlands sources
  if (url.includes('embed.su')) {
    headers['Referer'] = 'https://embed.su/';
    headers['Origin'] = 'https://embed.su';
  } else if (url.includes('lightningbolt')) {
    headers['Referer'] = 'https://vidsrc.cc/';
    headers['Origin'] = 'https://vidsrc.cc';
  }
  
  return headers;
}

// Legacy function for backward compatibility
async function fetchWithRetry(url, options, logger, retryCount = 0) {
  // Extract source and userAgent from options if available
  const userAgent = options.headers?.['User-Agent'];
  const source = 'unknown'; // Default source
  
  // Use the new header fallback system
  return fetchWithHeaderFallback(url, options, logger, userAgent, source, 0, retryCount);
}

// Get client IP address
function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  if (cfConnectingIp) return cfConnectingIp;
  if (realIp) return realIp;
  if (forwarded) return forwarded.split(',')[0].trim();
  
  return 'unknown';
}

// Validate stream URL
function validateStreamUrl(url, logger) {
  if (!url) {
    logger.error('Missing stream URL parameter');
    return { isValid: false, error: 'Stream URL parameter is required' };
  }

  try {
    const parsedUrl = new URL(url);
    logger.info('Stream URL validated', {
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      pathname: parsedUrl.pathname.substring(0, 100),
      isM3U8: url.includes('.m3u8'),
      isManifest: url.includes('manifest') || url.includes('playlist')
    });
    return { isValid: true, parsedUrl };
  } catch (e) {
    logger.error('Invalid stream URL format', e, { providedUrl: url });
    return { isValid: false, error: 'Invalid stream URL format' };
  }
}

// REMOVED complex header strategies - simplified headers are now used directly in fetchWithHeaderFallback

// Handle different response types
function getResponseHeaders(originalResponse, logger, skipContentLength = false) {
  const responseHeaders = new Headers();
  
  // Copy essential headers from original response
  const headersToKeep = [
    'content-type',
    ...(skipContentLength ? [] : ['content-length']), // Skip content-length if specified
    'content-range',
    'accept-ranges',
    'cache-control',
    'expires',
    'last-modified',
    'etag'
  ];

  headersToKeep.forEach(header => {
    const value = originalResponse.headers.get(header);
    if (value) {
      responseHeaders.set(header, value);
    }
  });

  // Add CORS headers
  responseHeaders.set('Access-Control-Allow-Origin', '*');
  responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  responseHeaders.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Range');
  responseHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  responseHeaders.set('Cross-Origin-Resource-Policy', 'cross-origin');

  logger.debug('Response headers prepared', {
    originalHeaders: Object.keys(Object.fromEntries(originalResponse.headers.entries())).length,
    keptHeaders: headersToKeep.filter(h => originalResponse.headers.get(h)).length,
    corsEnabled: true
  });

  return responseHeaders;
}

// Process M3U8 playlist content and rewrite URLs to use our proxy
async function processM3U8Playlist(m3u8Content, originalUrl, request, logger, source) {
  const lines = m3u8Content.split('\n');
  const processedLines = [];
  const baseUrl = new URL(originalUrl);
  const proxyBaseUrl = new URL(request.url).origin;
  
  let streamCount = 0;
  let processedCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines and comments (except URLs)
    if (!line || line.startsWith('#')) {
      processedLines.push(line);
      continue;
    }
    
    streamCount++;
    
    try {
      let targetUrl;
      
      if (line.startsWith('http://') || line.startsWith('https://')) {
        // Absolute URL
        targetUrl = line;
      } else if (line.startsWith('/')) {
        // Root-relative URL
        targetUrl = `${baseUrl.protocol}//${baseUrl.host}${line}`;
      } else {
        // Relative URL
        const basePath = originalUrl.substring(0, originalUrl.lastIndexOf('/') + 1);
        targetUrl = basePath + line;
      }
      
      // Create proxied URL with source parameter
      const sourceParam = source ? `&source=${encodeURIComponent(source)}` : '';
      const proxiedUrl = `${proxyBaseUrl}/api/stream-proxy?url=${encodeURIComponent(targetUrl)}${sourceParam}`;
      processedLines.push(proxiedUrl);
      processedCount++;
      
      logger.debug('URL rewritten in M3U8', {
        original: line.substring(0, 100),
        resolved: targetUrl.substring(0, 100),
        proxied: proxiedUrl.substring(0, 100)
      });
      
    } catch (error) {
      logger.warn('Failed to process M3U8 line', error, { 
        line: line.substring(0, 100),
        lineNumber: i + 1 
      });
      // Keep original line if processing fails
      processedLines.push(line);
    }
  }
  
  logger.info('M3U8 URL rewriting completed', {
    totalLines: lines.length,
    streamUrls: streamCount,
    processedUrls: processedCount,
    skippedUrls: streamCount - processedCount,
    finalContentLength: processedLines.join('\n').length
  });
  
  const finalContent = processedLines.join('\n');
  
  // Debug: Log the final few lines to check for truncation
  const finalLines = finalContent.split('\n');
  logger.debug('M3U8 final content check', {
    totalFinalLines: finalLines.length,
    lastFewLines: finalLines.slice(-3).map((line, idx) => ({
      index: finalLines.length - 3 + idx,
      content: line.substring(0, 150) + (line.length > 150 ? '...' : ''),
      isComplete: !line.includes('...') && (line.startsWith('#') || line.startsWith('http'))
    }))
  });
  
  return finalContent;
}

// Main GET handler
export async function GET(request) {
  const requestId = generateRequestId();
  const logger = createLogger(requestId);
  const requestStartTime = Date.now();
  const clientIp = getClientIp(request);

  // SUPER VISIBLE REQUEST START - using console.error for Vercel visibility
  console.error('='.repeat(80));
  console.error('STREAM-PROXY REQUEST INCOMING');
  console.error(`REQUEST ID: ${requestId}`);
  console.error(`TIMESTAMP: ${new Date().toISOString()}`);
  console.error(`CLIENT IP: ${clientIp}`);
  console.error('='.repeat(80));
  
  logger.request('GET', request.url, {
    'user-agent': request.headers.get('user-agent'),
    'referer': request.headers.get('referer'),
    'origin': request.headers.get('origin'),
    'x-forwarded-for': request.headers.get('x-forwarded-for'),
    'range': request.headers.get('range'),
    'accept': request.headers.get('accept'),
    'accept-encoding': request.headers.get('accept-encoding')
  });

  logger.step(0, 'REQUEST INITIALIZATION', {
    requestId,
    timestamp: new Date().toISOString(),
    clientIp,
    fullUrl: request.url,
    urlLength: request.url.length,
    method: request.method,
    userAgent: request.headers.get('user-agent')?.substring(0, 150) + (request.headers.get('user-agent')?.length > 150 ? '...' : ''),
    referer: request.headers.get('referer'),
    origin: request.headers.get('origin'),
    hasRangeHeader: !!request.headers.get('range'),
    rangeHeader: request.headers.get('range'),
    allRequestHeaders: Object.fromEntries(
      Array.from(request.headers.entries()).map(([k, v]) => [
        k, 
        typeof v === 'string' && v.length > 100 ? v.substring(0, 100) + '...' : v
      ])
    )
  });
  
  logger.memory();

  // Enhanced request validation (Requirement 4.2)
  const requestValidation = validateRequest(request, logger);
  if (!requestValidation.isValid) {
    logger.error('Request validation failed', null, { 
      error: requestValidation.error,
      clientIp 
    });
    return NextResponse.json({
      success: false,
      error: requestValidation.error,
      requestId
    }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const streamUrl = searchParams.get('url');
  const source = searchParams.get('source'); // 'vidsrc', 'embed.su', 'shadowlands', etc.

  // IMMEDIATE URL VALIDATION - catch bad URLs early
  logger.info('URL Parameters Parsed', {
    fullRequestUrl: request.url,
    streamUrl: streamUrl ? streamUrl.substring(0, 150) + (streamUrl.length > 150 ? '...' : '') : 'NULL',
    streamUrlLength: streamUrl?.length || 0,
    source: source || 'NULL',
    allParams: Object.fromEntries(searchParams.entries())
  });

  // Early validation - check if URL is missing or malformed
  if (!streamUrl || streamUrl.trim() === '') {
    logger.error('MISSING STREAM URL', null, {
      providedUrl: streamUrl,
      allParams: Object.fromEntries(searchParams.entries())
    });
    return NextResponse.json({
      success: false,
      error: 'Stream URL parameter is required and cannot be empty',
      requestId,
      providedUrl: streamUrl
    }, { status: 400 });
  }

  // Check if URL looks incomplete (like "https://.m3u8")
  if (streamUrl.includes('://.') || streamUrl.match(/https?:\/\/[^\/]*\.m3u8/) && streamUrl.length < 30) {
    logger.error('MALFORMED STREAM URL DETECTED', null, {
      providedUrl: streamUrl,
      urlLength: streamUrl.length,
      issue: 'URL appears incomplete or malformed'
    });
    return NextResponse.json({
      success: false,
      error: 'Stream URL appears to be malformed or incomplete',
      requestId,
      providedUrl: streamUrl
    }, { status: 400 });
  }

  // Rate limiting check (Requirement 5.3)
  const isLightningboltUrl = (streamUrl?.includes('lightningbolt') || streamUrl?.includes('lightningbolts.ru')) || false;
  const rateLimitResult = checkRateLimit(clientIp, logger, isLightningboltUrl);
  if (!rateLimitResult.allowed) {
    logger.warn('Rate limit exceeded', { clientIp, blocked: rateLimitResult.blocked, isLightningboltUrl });
    return NextResponse.json({
      success: false,
      error: 'Rate limit exceeded',
      retryAfter: rateLimitResult.retryAfter,
      requestId
    }, {
      status: 429,
      headers: {
        'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(Date.now() + (rateLimitResult.retryAfter * 1000)).toISOString()
      }
    });
  }

  logger.info('Stream proxy parameters', {
    url: streamUrl?.substring(0, 100) + (streamUrl?.length > 100 ? '...' : ''),
    source: source || 'unknown',
    rateLimitRemaining: rateLimitResult.remaining
  });

  // Validate stream URL
  const validation = validateStreamUrl(streamUrl, logger);
  if (!validation.isValid) {
    logger.error('Stream URL validation failed', null, { error: validation.error });
    return NextResponse.json({
      success: false,
      error: validation.error,
      requestId
    }, { status: 400 });
  }

  try {
    logger.step(1, 'PREPARING STREAM FETCH', {
      streamUrl: streamUrl.substring(0, 150) + (streamUrl.length > 150 ? '...' : ''),
      source: source || 'unknown',
      urlLength: streamUrl.length,
      urlHost: new URL(streamUrl).hostname,
      urlProtocol: new URL(streamUrl).protocol,
      urlPathname: new URL(streamUrl).pathname.substring(0, 100)
    });
    
    const fetchStartTime = Date.now();
    
    // Prepare base fetch options
    const rangeHeader = request.headers.get('range');
    const userAgent = request.headers.get('user-agent');
    
    logger.step(2, 'CONFIGURING FETCH OPTIONS', {
      method: 'GET',
      hasRangeHeader: !!rangeHeader,
      rangeHeader: rangeHeader || 'none',
      userAgent: userAgent?.substring(0, 100) + (userAgent?.length > 100 ? '...' : ''),
      timeout: CONNECTION_POOL_CONFIG.timeout,
      keepalive: true
    });
    
    const baseFetchOptions = {
      method: 'GET',
      signal: AbortSignal.timeout(CONNECTION_POOL_CONFIG.timeout),
      keepalive: true,
      headers: rangeHeader ? { 'Range': rangeHeader } : {}
    };

    if (rangeHeader) {
      logger.debug('Range request detected - partial content requested', { 
        range: rangeHeader,
        isVideoSeek: rangeHeader.includes('bytes=')
      });
    }

    logger.step(3, 'CALLING FETCH WITH HEADER FALLBACK', {
      timestamp: new Date().toISOString()
    });

    // Use enhanced fetch with header fallback strategies
    const response = await fetchWithHeaderFallback(
      streamUrl, 
      baseFetchOptions, 
      logger, 
      userAgent, 
      source
    );

    const fetchDuration = logger.timing('Stream fetch', fetchStartTime);
    
    logger.step(4, 'FETCH RETURNED SUCCESSFULLY', {
      duration: `${fetchDuration}ms`,
      status: response.status,
      ok: response.ok
    });

    if (!response.ok) {
      logger.error('STREAM FETCH FAILED - NON-OK STATUS', null, {
        status: response.status,
        statusText: response.statusText,
        url: streamUrl.substring(0, 100),
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
        allHeaders: Object.fromEntries(response.headers.entries()),
        isClientError: response.status >= 400 && response.status < 500,
        isServerError: response.status >= 500,
        isRedirect: response.status >= 300 && response.status < 400
      });
      
      // Try to read error body if available
      let errorBody = null;
      try {
        const errorText = await response.text();
        errorBody = errorText.substring(0, 500);
        logger.debug('Error response body', { body: errorBody });
      } catch (e) {
        logger.debug('Could not read error response body', { error: e.message });
      }
      
      return NextResponse.json({
        success: false,
        error: `Stream fetch failed: ${response.status} ${response.statusText}`,
        errorBody: errorBody,
        requestId
      }, { status: response.status });
    }

    logger.success('STREAM FETCH SUCCESSFUL', {
      status: response.status,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
      hasRangeSupport: !!response.headers.get('accept-ranges'),
      acceptRanges: response.headers.get('accept-ranges'),
      contentRange: response.headers.get('content-range'),
      fetchDuration: `${fetchDuration}ms`,
      hasBody: !!response.body,
      bodyUsed: response.bodyUsed
    });

    // Check if this is an M3U8 playlist that needs URL rewriting
    const contentType = response.headers.get('content-type') || '';
    const isM3U8 = streamUrl.includes('.m3u8') ||
                   contentType.includes('application/vnd.apple.mpegurl') ||
                   contentType.includes('application/x-mpegURL');
    
    // Check if this is a TS segment (including lightningbolt.site with wrong content type)
    const isTSSegment = streamUrl.includes('.ts') ||
                       streamUrl.includes('lightningbolt') ||
                       streamUrl.includes('lightningbolts') || // Also check for plural form
                       contentType.includes('video/mp2t') ||
                       contentType.includes('application/octet-stream') ||
                       (contentType.includes('image') && streamUrl.includes('.ts'));
    
    // Check if this is a subtitle file
    const isSubtitle = streamUrl.includes('.vtt') || streamUrl.includes('.srt') ||
                      contentType.includes('text/vtt') || contentType.includes('text/plain');
    
    logger.step(5, 'CONTENT TYPE DETECTION', {
      contentType: contentType || 'none',
      isM3U8: isM3U8,
      isTSSegment: isTSSegment,
      isSubtitle: isSubtitle,
      urlExtension: streamUrl.split('.').pop()?.split('?')[0],
      detectionMethod: isM3U8 ? 'M3U8' : isTSSegment ? 'TS_SEGMENT' : isSubtitle ? 'SUBTITLE' : 'OTHER',
      willProcessContent: isM3U8 || isSubtitle,
      willStreamDirectly: isTSSegment || (!isM3U8 && !isSubtitle)
    });

    if (isM3U8) {
      // Process M3U8 playlist to rewrite URLs
      const m3u8ProcessingStart = Date.now();
      
      logger.step(6, 'STARTING M3U8 PROCESSING', {
        originalUrl: streamUrl.substring(0, 100),
        contentType: contentType,
        contentLength: response.headers.get('content-length')
      });

      try {
        logger.debug('Reading M3U8 response body as text');
        const textReadStart = Date.now();
        const m3u8Content = await response.text();
        const textReadDuration = Date.now() - textReadStart;
        
        logger.step(7, 'M3U8 CONTENT READ', {
          contentLength: m3u8Content.length,
          readDuration: `${textReadDuration}ms`,
          lineCount: m3u8Content.split('\n').length,
          firstLine: m3u8Content.split('\n')[0],
          hasExtM3U: m3u8Content.includes('#EXTM3U'),
          hasStreamInf: m3u8Content.includes('#EXT-X-STREAM-INF'),
          hasTargetDuration: m3u8Content.includes('#EXT-X-TARGETDURATION')
        });
        
        logger.debug('Processing M3U8 playlist URLs');
        const processedM3U8 = await processM3U8Playlist(m3u8Content, streamUrl, request, logger, source);
        
        logger.timing('M3U8 processing', m3u8ProcessingStart);
        
        // Prepare response headers (skip original content-length as we'll set our own)
        const responseHeaders = getResponseHeaders(response, logger, true);
        
        // Set correct content-length header for the processed content
        const processedBuffer = Buffer.from(processedM3U8, 'utf-8');
        responseHeaders.set('content-length', processedBuffer.length.toString());
        
        // Add rate limiting headers
        responseHeaders.set('X-RateLimit-Remaining', rateLimitResult.remaining?.toString() || '0');
        responseHeaders.set('X-RateLimit-Reset', new Date(Date.now() + RATE_LIMIT_CONFIG.windowMs).toISOString());
        
        logger.step(8, 'M3U8 PROCESSING COMPLETE', {
          originalLines: m3u8Content.split('\n').length,
          processedLines: processedM3U8.split('\n').length,
          originalLength: m3u8Content.length,
          processedLength: processedBuffer.length,
          sizeDifference: processedBuffer.length - m3u8Content.length,
          hasQualityStreams: processedM3U8.includes('EXT-X-STREAM-INF'),
          hasMediaSequence: processedM3U8.includes('EXT-X-MEDIA-SEQUENCE'),
          hasEndList: processedM3U8.includes('EXT-X-ENDLIST'),
          rateLimitRemaining: rateLimitResult.remaining,
          processingDuration: `${Date.now() - m3u8ProcessingStart}ms`
        });

        // Ensure the response is not truncated by using Buffer
        const responseBuffer = Buffer.from(processedM3U8, 'utf-8');
        
        logger.step(9, 'CREATING M3U8 RESPONSE', {
          bufferLength: responseBuffer.length,
          status: response.status,
          contentType: responseHeaders.get('content-type'),
          headerCount: Array.from(responseHeaders.keys()).length
        });
        
        const m3u8Response = new NextResponse(responseBuffer, {
          status: response.status,
          headers: responseHeaders
        });
        
        logger.success('M3U8 RESPONSE CREATED SUCCESSFULLY', {
          totalDuration: `${Date.now() - requestStartTime}ms`,
          m3u8ProcessingDuration: `${Date.now() - m3u8ProcessingStart}ms`
        });
        
        logger.memory();
        
        return m3u8Response;
      } catch (m3u8Error) {
        logger.error('M3U8 PROCESSING FAILED - USING FALLBACK', m3u8Error, {
          errorType: m3u8Error.name,
          errorMessage: m3u8Error.message,
          processingDuration: Date.now() - m3u8ProcessingStart
        });
        
        // Fallback to original content
        logger.warn('Attempting to read original M3U8 content as fallback');
        try {
          const fallbackContent = await response.text();
          logger.info('Fallback M3U8 content read successfully', {
            contentLength: fallbackContent.length
          });
          return new NextResponse(fallbackContent, {
            status: response.status,
            headers: responseHeaders
          });
        } catch (fallbackError) {
          logger.error('FALLBACK ALSO FAILED', fallbackError);
          throw m3u8Error; // Re-throw original error
        }
      }
    } else if (isSubtitle) {
      // Handle subtitle files with proper content-type
      const subtitleProcessingStart = Date.now();
      
      logger.step(6, 'STARTING SUBTITLE PROCESSING', {
        originalUrl: streamUrl.substring(0, 100),
        contentType: contentType,
        contentLength: response.headers.get('content-length'),
        isVTT: streamUrl.includes('.vtt'),
        isSRT: streamUrl.includes('.srt')
      });

      try {
        logger.debug('Reading subtitle response body as text');
        const textReadStart = Date.now();
        const subtitleContent = await response.text();
        const textReadDuration = Date.now() - textReadStart;
        
        logger.step(7, 'SUBTITLE CONTENT READ', {
          contentLength: subtitleContent.length,
          readDuration: `${textReadDuration}ms`,
          lineCount: subtitleContent.split('\n').length,
          firstLine: subtitleContent.split('\n')[0]?.substring(0, 100),
          hasWebVTTHeader: subtitleContent.includes('WEBVTT'),
          hasCueTimings: subtitleContent.includes('-->')
        });
        
        // Prepare response headers for subtitle
        const responseHeaders = getResponseHeaders(response, logger, true);
        
        // Set appropriate content-type for subtitles
        if (streamUrl.includes('.vtt') || contentType.includes('text/vtt')) {
          responseHeaders.set('content-type', 'text/vtt; charset=utf-8');
        } else if (streamUrl.includes('.srt')) {
          responseHeaders.set('content-type', 'text/plain; charset=utf-8');
        } else {
          responseHeaders.set('content-type', 'text/plain; charset=utf-8');
        }
        
        // Set correct content-length header
        const subtitleBuffer = Buffer.from(subtitleContent, 'utf-8');
        responseHeaders.set('content-length', subtitleBuffer.length.toString());
        
        // Add rate limiting headers
        responseHeaders.set('X-RateLimit-Remaining', rateLimitResult.remaining?.toString() || '0');
        responseHeaders.set('X-RateLimit-Reset', new Date(Date.now() + RATE_LIMIT_CONFIG.windowMs).toISOString());
        
        logger.step(8, 'SUBTITLE PROCESSING COMPLETE', {
          originalLength: subtitleContent.length,
          processedLength: subtitleBuffer.length,
          contentType: responseHeaders.get('content-type'),
          processingTime: `${Date.now() - subtitleProcessingStart}ms`,
          rateLimitRemaining: rateLimitResult.remaining
        });
        
        logger.step(9, 'CREATING SUBTITLE RESPONSE', {
          bufferLength: subtitleBuffer.length,
          status: response.status,
          headerCount: Array.from(responseHeaders.keys()).length
        });

        const subtitleResponse = new NextResponse(subtitleBuffer, {
          status: response.status,
          headers: responseHeaders
        });
        
        logger.success('SUBTITLE RESPONSE CREATED SUCCESSFULLY', {
          totalDuration: `${Date.now() - requestStartTime}ms`,
          subtitleProcessingDuration: `${Date.now() - subtitleProcessingStart}ms`
        });
        
        logger.memory();

        return subtitleResponse;
      } catch (subtitleError) {
        logger.error('SUBTITLE PROCESSING FAILED - USING FALLBACK', subtitleError, {
          errorType: subtitleError.name,
          errorMessage: subtitleError.message,
          processingDuration: Date.now() - subtitleProcessingStart
        });
        
        // Fallback to original content
        logger.warn('Streaming original subtitle content as fallback');
        const responseHeaders = getResponseHeaders(response, logger);
        
        const fallbackResponse = new NextResponse(response.body, {
          status: response.status,
          headers: responseHeaders
        });
        
        logger.info('Fallback subtitle response created');
        
        return fallbackResponse;
      }
    } else if (isTSSegment) {
      // Handle TS segments (including lightningbolt.site with wrong content type)
      const tsProcessingStart = Date.now();
      
      logger.step(6, 'STARTING TS SEGMENT PROCESSING', {
        originalUrl: streamUrl.substring(0, 150),
        contentType: contentType,
        contentLength: response.headers.get('content-length'),
        hasWrongContentType: contentType.includes('image') && streamUrl.includes('.ts'),
        isLightningbolt: streamUrl.includes('lightningbolt'),
        hasBody: !!response.body,
        bodyUsed: response.bodyUsed
      });

      // Prepare response headers with correct content type for TS segments
      const responseHeaders = getResponseHeaders(response, logger);
      
      let contentTypeFixed = false;
      let originalContentType = contentType;
      
      // Fix content type for TS segments with wrong content type
      if (contentType.includes('image')) {
        responseHeaders.set('content-type', 'video/mp2t');
        contentTypeFixed = true;
        logger.info('Fixed content type from image to video/mp2t for TS segment');
      } else if (!contentType || contentType.includes('application/octet-stream')) {
        responseHeaders.set('content-type', 'video/mp2t');
        contentTypeFixed = true;
        logger.info('Set content type to video/mp2t for TS segment (was octet-stream)');
      } else if (!contentType || contentType === 'text/plain') {
        responseHeaders.set('content-type', 'video/mp2t');
        contentTypeFixed = true;
        logger.info('Set content type to video/mp2t for TS segment (was text/plain)');
      }

      // Add rate limiting headers
      responseHeaders.set('X-RateLimit-Remaining', rateLimitResult.remaining?.toString() || '0');
      responseHeaders.set('X-RateLimit-Reset', new Date(Date.now() + RATE_LIMIT_CONFIG.windowMs).toISOString());

      logger.step(7, 'TS SEGMENT HEADERS PREPARED', {
        status: response.status,
        originalContentType: originalContentType,
        finalContentType: responseHeaders.get('content-type'),
        contentTypeFixed: contentTypeFixed,
        contentLength: responseHeaders.get('content-length'),
        hasRangeSupport: !!responseHeaders.get('accept-ranges'),
        rateLimitRemaining: rateLimitResult.remaining,
        headerCount: Array.from(responseHeaders.keys()).length
      });

      // Stream the response directly for TS segments
      const tsResponse = new NextResponse(response.body, {
        status: response.status,
        headers: responseHeaders
      });
      
      logger.success('TS SEGMENT RESPONSE CREATED SUCCESSFULLY', {
        totalDuration: `${Date.now() - requestStartTime}ms`,
        tsProcessingDuration: `${Date.now() - tsProcessingStart}ms`,
        status: response.status
      });
      
      logger.memory();

      return tsResponse;
    } else {
      // Prepare response headers for non-M3U8 content
      logger.step(6, 'PREPARING DIRECT STREAM RESPONSE', {
        contentType: contentType || 'unknown',
        contentLength: response.headers.get('content-length'),
        hasBody: !!response.body,
        bodyUsed: response.bodyUsed
      });
      
      const responseHeaders = getResponseHeaders(response, logger);
      
      // Stream the response directly for non-M3U8 content
      const responseStartTime = Date.now();

      // Add rate limiting headers to response
      responseHeaders.set('X-RateLimit-Remaining', rateLimitResult.remaining?.toString() || '0');
      responseHeaders.set('X-RateLimit-Reset', new Date(Date.now() + RATE_LIMIT_CONFIG.windowMs).toISOString());

      logger.step(7, 'CREATING STREAM RESPONSE', {
        status: response.status,
        headerCount: Array.from(responseHeaders.keys()).length,
        hasRateLimitHeaders: responseHeaders.has('X-RateLimit-Remaining')
      });

      const finalStreamResponse = new NextResponse(response.body, {
        status: response.status,
        headers: responseHeaders
      });

      logger.success('STREAM PROXY COMPLETED SUCCESSFULLY', {
        totalDuration: `${Date.now() - requestStartTime}ms`,
        streamSetupTime: `${Date.now() - responseStartTime}ms`,
        status: response.status,
        contentType: contentType || 'unknown',
        rateLimitRemaining: rateLimitResult.remaining,
        finalResponseStatus: finalStreamResponse.status
      });
      
      logger.memory();

      return finalStreamResponse;
    }

  } catch (error) {
    console.error('='.repeat(80));
    console.error('STREAM PROXY FATAL ERROR');
    console.error('='.repeat(80));
    
    logger.error('STREAM PROXY FAILED WITH EXCEPTION', error, {
      streamUrl: streamUrl?.substring(0, 150),
      source: source,
      requestDuration: `${Date.now() - requestStartTime}ms`,
      errorType: error.name,
      errorMessage: error.message,
      errorCode: error.code,
      errorCause: error.cause,
      errorStack: error.stack?.split('\n').slice(0, 15).join('\n'),
      isTimeout: error.name === 'AbortError' || error.name === 'TimeoutError',
      isNetworkError: error.name === 'TypeError' && error.message.includes('fetch'),
      isDNSError: error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN',
      isConnectionRefused: error.code === 'ECONNREFUSED',
      isConnectionReset: error.code === 'ECONNRESET',
      isSSLError: error.message?.includes('SSL') || error.message?.includes('certificate'),
      clientIp: clientIp
    });

    // Handle different error types
    let status = 500;
    let errorMessage = 'Stream proxy failed';
    let errorCategory = 'UNKNOWN';

    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      status = 408;
      errorMessage = 'Stream request timeout';
      errorCategory = 'TIMEOUT';
      logger.warn('Request timed out', {
        timeout: CONNECTION_POOL_CONFIG.timeout,
        suggestion: 'Stream source may be slow or unresponsive'
      });
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
      status = 502;
      errorMessage = 'Failed to connect to stream source';
      errorCategory = 'NETWORK';
      logger.warn('Network connection failed', {
        suggestion: 'Stream source may be down or unreachable'
      });
    } else if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
      status = 502;
      errorMessage = 'DNS resolution failed';
      errorCategory = 'DNS';
      logger.warn('DNS lookup failed', {
        suggestion: 'Stream source hostname cannot be resolved'
      });
    } else if (error.code === 'ECONNREFUSED') {
      status = 502;
      errorMessage = 'Connection refused by stream source';
      errorCategory = 'CONNECTION_REFUSED';
      logger.warn('Connection refused', {
        suggestion: 'Stream source is not accepting connections'
      });
    } else if (error.code === 'ECONNRESET') {
      status = 502;
      errorMessage = 'Connection reset by stream source';
      errorCategory = 'CONNECTION_RESET';
      logger.warn('Connection reset', {
        suggestion: 'Stream source closed the connection unexpectedly'
      });
    } else if (error.message?.includes('SSL') || error.message?.includes('certificate')) {
      status = 502;
      errorMessage = 'SSL/TLS error';
      errorCategory = 'SSL';
      logger.warn('SSL/TLS error', {
        suggestion: 'Stream source has certificate issues'
      });
    }

    logger.memory();

    return NextResponse.json({
      success: false,
      error: errorMessage,
      errorCategory: errorCategory,
      details: error.message,
      requestId,
      timing: {
        totalDuration: `${Date.now() - requestStartTime}ms`,
        timestamp: new Date().toISOString()
      },
      debug: {
        errorName: error.name,
        errorCode: error.code,
        streamUrl: streamUrl?.substring(0, 100) + '...'
      }
    }, { status });
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(request) {
  const requestId = generateRequestId();
  const logger = createLogger(requestId);
  const clientIp = getClientIp(request);

  logger.info('CORS preflight request', {
    clientIp,
    origin: request.headers.get('origin'),
    method: request.headers.get('access-control-request-method'),
    headers: request.headers.get('access-control-request-headers')
  });

  // Apply rate limiting to OPTIONS requests as well
  const { searchParams: optionsParams } = new URL(request.url);
  const optionsStreamUrl = optionsParams.get('url');
  const isOptionsLightningboltUrl = (optionsStreamUrl?.includes('lightningbolt') || optionsStreamUrl?.includes('lightningbolts.ru')) || false;
  const rateLimitResult = checkRateLimit(clientIp, logger, isOptionsLightningboltUrl);
  if (!rateLimitResult.allowed) {
    return new NextResponse(null, {
      status: 429,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(Date.now() + (rateLimitResult.retryAfter * 1000)).toISOString()
      }
    });
  }

  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Range',
      'Access-Control-Max-Age': '86400',
      'X-RateLimit-Remaining': rateLimitResult.remaining?.toString() || '0',
      'X-RateLimit-Reset': new Date(Date.now() + RATE_LIMIT_CONFIG.windowMs).toISOString()
    }
  });
}

// Handle HEAD requests for stream info
export async function HEAD(request) {
  const requestId = generateRequestId();
  const logger = createLogger(requestId);
  const clientIp = getClientIp(request);

  logger.info('HEAD request for stream info', { clientIp });

  // Apply rate limiting and request validation
  const requestValidation = validateRequest(request, logger);
  if (!requestValidation.isValid) {
    return new NextResponse(null, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const streamUrl = searchParams.get('url');
  const source = searchParams.get('source');

  const isHeadLightningboltUrl = (streamUrl?.includes('lightningbolt') || streamUrl?.includes('lightningbolts.ru')) || false;
  const rateLimitResult = checkRateLimit(clientIp, logger, isHeadLightningboltUrl);
  if (!rateLimitResult.allowed) {
    return new NextResponse(null, {
      status: 429,
      headers: {
        'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(Date.now() + (rateLimitResult.retryAfter * 1000)).toISOString()
      }
    });
  }

  const validation = validateStreamUrl(streamUrl, logger);
  if (!validation.isValid) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const userAgent = request.headers.get('user-agent');
    
    // Use enhanced fetch with header fallback strategies
    const baseFetchOptions = {
      method: 'HEAD',
      signal: AbortSignal.timeout(CONNECTION_POOL_CONFIG.timeout),
      keepalive: true
    };

    const response = await fetchWithHeaderFallback(
      streamUrl,
      baseFetchOptions,
      logger,
      userAgent,
      source
    );

    const responseHeaders = getResponseHeaders(response, logger);
    
    // Add rate limiting headers
    responseHeaders.set('X-RateLimit-Remaining', rateLimitResult.remaining?.toString() || '0');
    responseHeaders.set('X-RateLimit-Reset', new Date(Date.now() + RATE_LIMIT_CONFIG.windowMs).toISOString());
    
    // Set appropriate content-type for subtitle files
    const isSubtitle = streamUrl.includes('.vtt') || streamUrl.includes('.srt');
    if (isSubtitle) {
      if (streamUrl.includes('.vtt')) {
        responseHeaders.set('content-type', 'text/vtt; charset=utf-8');
      } else if (streamUrl.includes('.srt')) {
        responseHeaders.set('content-type', 'text/plain; charset=utf-8');
      }
    }
    
    // Set appropriate content-type for TS segments
    const isTSSegment = streamUrl.includes('.ts') ||
                       streamUrl.includes('lightningbolt') ||
                       streamUrl.includes('lightningbolts') || // Also check for plural form
                       (response.headers.get('content-type') || '').includes('image') && streamUrl.includes('.ts');
    if (isTSSegment) {
      // Fix content type for TS segments with wrong content type
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('image')) {
        responseHeaders.set('content-type', 'video/mp2t');
      } else if (!contentType || contentType.includes('application/octet-stream') || contentType === 'text/plain') {
        responseHeaders.set('content-type', 'video/mp2t');
      } else {
        responseHeaders.set('content-type', 'video/mp2t');
      }
    }
    
    return new NextResponse(null, {
      status: response.status,
      headers: responseHeaders
    });

  } catch (error) {
    logger.error('HEAD request failed', error);
    return new NextResponse(null, { status: 500 });
  }
}