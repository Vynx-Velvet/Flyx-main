/**
 * DLHD Stream Proxy API
 * 
 * Proxies DLHD.dad streams with automatic server lookup and key fetching.
 * 
 * Caching Strategy:
 *   - Keys are cached for 10 minutes per channel
 *   - M3U8 content is cached for 2 seconds (live stream refresh rate)
 *   - Cache is invalidated when key fails to decrypt
 *   - Segment URLs point directly to CDN (not proxied)
 */

import { NextRequest, NextResponse } from 'next/server';

// Use edge runtime - different IP ranges that may not be blocked
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const PLAYER_DOMAINS = ['epicplayplay.cfd', 'daddyhd.com'];

const CDN_PATTERNS = {
  standard: (serverKey: string, channelKey: string) => 
    `https://${serverKey}new.giokko.ru/${serverKey}/${channelKey}/mono.css`,
  top1cdn: (channelKey: string) => 
    `https://top1.giokko.ru/top1/cdn/${channelKey}/mono.css`,
};

// Cache configuration
const KEY_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes for keys
const M3U8_CACHE_TTL_MS = 2000; // 2 seconds for M3U8 (live stream segment duration)

interface CachedKey {
  keyBuffer: ArrayBuffer;
  keyBase64: string;
  keyHex: string;
  keyUrl: string;
  fetchedAt: number;
  playerDomain: string;
}

interface CachedM3U8 {
  content: string;
  m3u8Url: string;
  playerDomain: string;
  fetchedAt: number;
}

// In-memory caches
const keyCache = new Map<string, CachedKey>();
const m3u8Cache = new Map<string, CachedM3U8>();


function isKeyCacheValid(cached: CachedKey | undefined): cached is CachedKey {
  if (!cached) return false;
  return (Date.now() - cached.fetchedAt) < KEY_CACHE_TTL_MS;
}

function isM3U8CacheValid(cached: CachedM3U8 | undefined): cached is CachedM3U8 {
  if (!cached) return false;
  return (Date.now() - cached.fetchedAt) < M3U8_CACHE_TTL_MS;
}

function getCachedKey(channelId: string): CachedKey | null {
  const cached = keyCache.get(channelId);
  if (isKeyCacheValid(cached)) {
    console.log(`[DLHD] Key cache hit for ${channelId} (age: ${Math.round((Date.now() - cached.fetchedAt) / 1000)}s)`);
    return cached;
  }
  return null;
}

function getCachedM3U8(channelId: string): CachedM3U8 | null {
  const cached = m3u8Cache.get(channelId);
  if (isM3U8CacheValid(cached)) {
    console.log(`[DLHD] M3U8 cache hit for ${channelId} (age: ${Date.now() - cached.fetchedAt}ms)`);
    return cached;
  }
  return null;
}

function invalidateKeyCache(channelId: string): void {
  if (keyCache.has(channelId)) {
    console.log(`[DLHD] Invalidating key cache for ${channelId}`);
    keyCache.delete(channelId);
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function cacheKey(channelId: string, keyBuffer: ArrayBuffer, keyUrl: string, playerDomain: string): CachedKey {
  const cached: CachedKey = {
    keyBuffer,
    keyBase64: arrayBufferToBase64(keyBuffer),
    keyHex: arrayBufferToHex(keyBuffer),
    keyUrl,
    fetchedAt: Date.now(),
    playerDomain,
  };
  keyCache.set(channelId, cached);
  console.log(`[DLHD] Cached key for ${channelId}`);
  return cached;
}

function cacheM3U8(channelId: string, content: string, m3u8Url: string, playerDomain: string): CachedM3U8 {
  const cached: CachedM3U8 = { content, m3u8Url, playerDomain, fetchedAt: Date.now() };
  m3u8Cache.set(channelId, cached);
  return cached;
}


async function fetchWithHeaders(url: string, headers: Record<string, string> = {}): Promise<Response> {
  // Full browser-like headers to avoid CDN blocks
  const browserHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'cross-site',
    ...headers,
  };
  
  return fetch(url, {
    headers: browserHeaders,
    cache: 'no-store',
  });
}

async function getServerKey(channelKey: string): Promise<{ serverKey: string; playerDomain: string }> {
  let lastError: Error | null = null;
  
  for (const domain of PLAYER_DOMAINS) {
    const lookupUrl = `https://${domain}/server_lookup.js?channel_id=${channelKey}`;
    try {
      const response = await fetchWithHeaders(lookupUrl, {
        'Referer': `https://${domain}/`,
        'Origin': `https://${domain}`,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.server_key) {
          console.log(`[DLHD] Server key: ${data.server_key} from ${domain}`);
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
  if (serverKey === 'top1/cdn') return CDN_PATTERNS.top1cdn(channelKey);
  return CDN_PATTERNS.standard(serverKey, channelKey);
}


async function fetchM3U8(channelId: string): Promise<{ content: string; m3u8Url: string; playerDomain: string }> {
  // Check M3U8 cache first
  const cachedM3U8 = getCachedM3U8(channelId);
  if (cachedM3U8) {
    return { content: cachedM3U8.content, m3u8Url: cachedM3U8.m3u8Url, playerDomain: cachedM3U8.playerDomain };
  }

  const channelKey = `premium${channelId}`;
  const { serverKey, playerDomain } = await getServerKey(channelKey);
  const m3u8Url = constructM3U8Url(serverKey, channelKey);
  
  console.log(`[DLHD] Fetching M3U8: ${m3u8Url}`);
  
  // NOTE: M3U8 fetch works WITHOUT Referer/Origin headers
  // The CDN may reject requests with non-whitelisted origins
  const response = await fetchWithHeaders(m3u8Url);

  console.log(`[DLHD] M3U8 response: ${response.status}`);

  if (!response.ok) throw new Error(`Failed to fetch M3U8: HTTP ${response.status}`);

  const content = await response.text();
  console.log(`[DLHD] M3U8 content length: ${content.length}, valid: ${content.includes('#EXTM3U')}`);
  
  if (!content.includes('#EXTM3U') && !content.includes('#EXT-X-')) {
    throw new Error('Invalid M3U8 content received');
  }
  
  // Cache the M3U8
  cacheM3U8(channelId, content, m3u8Url, playerDomain);
  console.log(`[DLHD] Fetched M3U8 for ${channelId}, length: ${content.length}`);
  return { content, m3u8Url, playerDomain };
}

async function fetchKey(keyUrl: string, playerDomain: string, retries = 3): Promise<ArrayBuffer> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetchWithHeaders(keyUrl, {
        'Referer': `https://${playerDomain}/`,
        'Origin': `https://${playerDomain}`,
      });

      if (response.status === 418 && attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength !== 16) throw new Error(`Invalid key length: ${buffer.byteLength}`);
      return buffer;
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw new Error('Key fetch failed after retries');
}


function parseM3U8(content: string): { keyUrl: string | null; iv: string | null } {
  const keyMatch = content.match(/URI="([^"]+)"/);
  const ivMatch = content.match(/IV=0x([a-fA-F0-9]+)/);
  return { keyUrl: keyMatch?.[1] || null, iv: ivMatch?.[1] || null };
}

function generateProxiedM3U8(originalM3U8: string, keyBase64: string): string {
  const keyDataUri = `data:application/octet-stream;base64,${keyBase64}`;
  return originalM3U8.replace(/URI="[^"]+"/, `URI="${keyDataUri}"`);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const channel = searchParams.get('channel');
    const invalidate = searchParams.get('invalidate') === 'true';
    const baseProxyUrl = `${request.nextUrl.origin}/api/dlhd-proxy`;

    if (!channel) {
      return NextResponse.json({
        error: 'Missing channel parameter',
        usage: 'GET /api/dlhd-proxy?channel=325',
        caching: { keyTTL: '10 minutes', m3u8TTL: '2 seconds' },
      }, { status: 400 });
    }

    console.log(`[DLHD] Request for channel ${channel}${invalidate ? ' (invalidate)' : ''}`);
    
    if (invalidate) invalidateKeyCache(channel);
    
    let m3u8Content: string;
    let m3u8Url: string;
    let playerDomain: string;
    
    try {
      const result = await fetchM3U8(channel);
      m3u8Content = result.content;
      m3u8Url = result.m3u8Url;
      playerDomain = result.playerDomain;
    } catch (err) {
      console.error(`[DLHD] fetchM3U8 failed for ${channel}:`, err);
      return NextResponse.json(
        { error: 'Channel unavailable', details: err instanceof Error ? err.message : String(err) },
        { status: 404 }
      );
    }
    
    const { keyUrl, iv } = parseM3U8(m3u8Content);
    let keyBase64: string | null = null;
    let keyHex: string | null = null;
    let keyFromCache = false;

    
    if (keyUrl) {
      const cachedKey = getCachedKey(channel);
      
      if (cachedKey) {
        keyBase64 = cachedKey.keyBase64;
        keyHex = cachedKey.keyHex;
        keyFromCache = true;
      } else {
        try {
          const keyBuffer = await fetchKey(keyUrl, playerDomain);
          const cached = cacheKey(channel, keyBuffer, keyUrl, playerDomain);
          keyBase64 = cached.keyBase64;
          keyHex = cached.keyHex;
        } catch (err) {
          console.warn(`[DLHD] Key fetch failed:`, err);
        }
      }
    }

    // Generate M3U8 with embedded key (segments point directly to CDN)
    let proxiedM3U8: string;
    if (keyBase64 && keyUrl) {
      proxiedM3U8 = generateProxiedM3U8(m3u8Content, keyBase64);
    } else if (keyUrl) {
      // Fallback: proxy the key URL
      const proxiedKeyUrl = `${baseProxyUrl}/key?url=${encodeURIComponent(keyUrl)}`;
      proxiedM3U8 = m3u8Content.replace(/URI="[^"]+"/, `URI="${proxiedKeyUrl}"`);
    } else {
      proxiedM3U8 = m3u8Content;
    }

    const cachedKeyInfo = keyCache.get(channel);
    const cacheAge = cachedKeyInfo ? Math.round((Date.now() - cachedKeyInfo.fetchedAt) / 1000) : 0;
    const cacheTTL = cachedKeyInfo ? Math.round((KEY_CACHE_TTL_MS - (Date.now() - cachedKeyInfo.fetchedAt)) / 1000) : 0;

    return new NextResponse(proxiedM3U8, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type',
        'Cache-Control': 'no-cache',
        'X-DLHD-Key': keyHex || '',
        'X-DLHD-IV': iv || '',
        'X-DLHD-Channel': channel,
        'X-DLHD-M3U8-URL': m3u8Url,
        'X-DLHD-Key-Cached': keyFromCache ? 'true' : 'false',
        'X-DLHD-Key-Cache-Age': cacheAge.toString(),
        'X-DLHD-Key-Cache-TTL': cacheTTL.toString(),
      },
    });

  } catch (error) {
    console.error('[DLHD] Error:', error);
    return NextResponse.json(
      { error: 'Proxy error', details: error instanceof Error ? error.message : String(error) },
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
