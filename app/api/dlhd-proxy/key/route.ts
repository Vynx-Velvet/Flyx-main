/**
 * DLHD Key Proxy API
 * 
 * Fetches decryption keys for DLHD streams with proper headers.
 * Supports key caching with 10-minute TTL and cache invalidation.
 * 
 * GET /api/dlhd-proxy/key?url=<encoded_key_url>
 * GET /api/dlhd-proxy/key?channel=<id>
 * GET /api/dlhd-proxy/key?channel=<id>&invalidate=true - Force refresh
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Known player domains that host server_lookup.js
const PLAYER_DOMAINS = [
  'epicplayplay.cfd',
  'daddyhd.com',
];

// Key cache configuration
const KEY_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CachedKey {
  keyBuffer: ArrayBuffer;
  keyHex: string;
  keyUrl: string;
  fetchedAt: number;
  playerDomain: string;
}

// In-memory key cache (per channel)
const keyCache = new Map<string, CachedKey>();

/**
 * Check if a cached key is still valid
 */
function isKeyCacheValid(cached: CachedKey | undefined): cached is CachedKey {
  if (!cached) return false;
  const age = Date.now() - cached.fetchedAt;
  return age < KEY_CACHE_TTL_MS;
}

/**
 * Get cached key for a channel
 */
function getCachedKey(channelId: string): CachedKey | null {
  const cached = keyCache.get(channelId);
  if (isKeyCacheValid(cached)) {
    console.log(`[DLHD Key] Using cached key for channel ${channelId} (age: ${Math.round((Date.now() - cached.fetchedAt) / 1000)}s)`);
    return cached;
  }
  return null;
}

/**
 * Invalidate cached key for a channel
 */
function invalidateKeyCache(channelId: string): void {
  if (keyCache.has(channelId)) {
    console.log(`[DLHD Key] Invalidating key cache for channel ${channelId}`);
    keyCache.delete(channelId);
  }
}

/**
 * Store key in cache
 */
function cacheKey(channelId: string, keyBuffer: ArrayBuffer, keyUrl: string, playerDomain: string): CachedKey {
  const cached: CachedKey = {
    keyBuffer,
    keyHex: Buffer.from(keyBuffer).toString('hex'),
    keyUrl,
    fetchedAt: Date.now(),
    playerDomain,
  };
  keyCache.set(channelId, cached);
  console.log(`[DLHD Key] Cached key for channel ${channelId}`);
  return cached;
}

// Raspberry Pi proxy - REQUIRED for all external requests
const RPI_PROXY_URL = process.env.RPI_PROXY_URL;
const RPI_PROXY_KEY = process.env.RPI_PROXY_KEY;

async function fetchViaProxy(url: string): Promise<Response> {
  console.log(`[DLHD Key] Fetching via RPI proxy: ${url}`);
  
  if (!RPI_PROXY_URL || !RPI_PROXY_KEY) {
    throw new Error('RPI_PROXY_URL and RPI_PROXY_KEY environment variables are required');
  }

  const proxyUrl = `${RPI_PROXY_URL}/proxy?url=${encodeURIComponent(url)}`;
  const response = await fetch(proxyUrl, {
    headers: { 'X-API-Key': RPI_PROXY_KEY },
    cache: 'no-store',
  });
  
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`RPI proxy failed: ${response.status} - ${text}`);
  }
  
  console.log(`[DLHD Key] RPI proxy success`);
  return response;
}

async function fetchWithHeaders(url: string, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': '*/*',
      ...headers,
    },
    cache: 'no-store',
  });
}

async function getServerKey(channelKey: string): Promise<{ serverKey: string; playerDomain: string }> {
  let lastError: Error | null = null;
  
  for (const domain of PLAYER_DOMAINS) {
    const lookupUrl = `https://${domain}/server_lookup.js?channel_id=${channelKey}`;
    const referer = `https://${domain}/`;
    
    try {
      const response = await fetchWithHeaders(lookupUrl, {
        'Referer': referer,
        'Origin': `https://${domain}`,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.server_key) {
          return { serverKey: data.server_key, playerDomain: domain };
        }
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  
  throw lastError || new Error('All server lookups failed');
}

function constructM3U8Url(serverKey: string, channelKey: string): string {
  if (serverKey === 'top1/cdn') {
    return `https://top1.giokko.ru/top1/cdn/${channelKey}/mono.css`;
  }
  return `https://${serverKey}new.giokko.ru/${serverKey}/${channelKey}/mono.css`;
}

async function fetchM3U8ViaProxy(url: string): Promise<string> {
  const response = await fetchViaProxy(url);
  return response.text();
}

async function getKeyUrlFromChannel(channelId: string): Promise<{ keyUrl: string; playerDomain: string }> {
  const channelKey = `premium${channelId}`;
  const { serverKey, playerDomain } = await getServerKey(channelKey);
  const m3u8Url = constructM3U8Url(serverKey, channelKey);
  
  const content = await fetchM3U8ViaProxy(m3u8Url);
  const keyMatch = content.match(/URI="([^"]+)"/);

  if (!keyMatch) {
    throw new Error('No key URL found in M3U8');
  }

  return { keyUrl: keyMatch[1], playerDomain };
}

async function fetchKeyViaProxy(keyUrl: string): Promise<ArrayBuffer> {
  const response = await fetchViaProxy(keyUrl);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength !== 16) throw new Error(`Invalid key length: ${buffer.byteLength}`);
  return buffer;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');
    const channel = searchParams.get('channel');
    const invalidate = searchParams.get('invalidate') === 'true';

    let keyUrl: string;
    let playerDomain = PLAYER_DOMAINS[0];
    let keyBuffer: ArrayBuffer;
    let keyFromCache = false;

    if (channel) {
      // Check if we should invalidate the cache
      if (invalidate) {
        invalidateKeyCache(channel);
      }
      
      // Try to use cached key first
      const cachedKey = getCachedKey(channel);
      
      if (cachedKey) {
        keyBuffer = cachedKey.keyBuffer;
        keyFromCache = true;
      } else {
        // Fetch fresh key
        const result = await getKeyUrlFromChannel(channel);
        keyUrl = result.keyUrl;
        playerDomain = result.playerDomain;
        keyBuffer = await fetchKeyViaProxy(keyUrl);
        
        // Cache the key
        cacheKey(channel, keyBuffer, keyUrl, playerDomain);
      }
    } else if (url) {
      keyUrl = decodeURIComponent(url);
      keyBuffer = await fetchKeyViaProxy(keyUrl);
    } else {
      return NextResponse.json(
        {
          error: 'Missing parameters',
          usage: {
            url: 'GET /api/dlhd-proxy/key?url=<encoded_key_url>',
            channel: 'GET /api/dlhd-proxy/key?channel=325',
            invalidate: 'GET /api/dlhd-proxy/key?channel=325&invalidate=true - Force refresh',
          },
          caching: {
            keyTTL: `${KEY_CACHE_TTL_MS / 1000 / 60} minutes`,
            note: 'Keys are cached per channel. Use invalidate=true if decryption fails.',
          },
        },
        { status: 400 }
      );
    }

    if (keyBuffer.byteLength !== 16) {
      return NextResponse.json(
        { error: `Invalid key length: ${keyBuffer.byteLength} (expected 16)` },
        { status: 500 }
      );
    }

    // Calculate cache info for response headers
    const cachedKey = channel ? keyCache.get(channel) : null;
    const cacheAge = cachedKey ? Math.round((Date.now() - cachedKey.fetchedAt) / 1000) : 0;
    const cacheTTL = cachedKey ? Math.round((KEY_CACHE_TTL_MS - (Date.now() - cachedKey.fetchedAt)) / 1000) : 0;

    return new NextResponse(keyBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': '16',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type',
        'Cache-Control': 'no-cache',
        'X-DLHD-Key-Hex': Buffer.from(keyBuffer).toString('hex'),
        'X-DLHD-Key-Cached': keyFromCache ? 'true' : 'false',
        'X-DLHD-Key-Cache-Age': cacheAge.toString(),
        'X-DLHD-Key-Cache-TTL': cacheTTL.toString(),
      },
    });

  } catch (error) {
    return NextResponse.json(
      {
        error: 'Key fetch error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
    },
  });
}
