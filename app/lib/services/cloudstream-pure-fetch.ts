/**
 * CloudStream Pure Fetch Extractor
 * 
 * Pure fetch-based M3U8 extraction from vidsrc-embed.ru
 * Handles all rotating encryption methods (Caesar shifts, Base64, Hex, etc.)
 */

interface ExtractionResult {
  success: boolean;
  url?: string;
  method?: string;
  error?: string;
  logs?: string[];
}

/**
 * Caesar cipher shift
 */
function caesarShift(text: string, shift: number): string {
  return text
    .split('')
    .map((c) => {
      const code = c.charCodeAt(0);

      // Uppercase A-Z
      if (code >= 65 && code <= 90) {
        return String.fromCharCode(((code - 65 + shift + 26) % 26) + 65);
      }

      // Lowercase a-z
      if (code >= 97 && code <= 122) {
        return String.fromCharCode(((code - 97 + shift + 26) % 26) + 97);
      }

      // Non-alphabetic unchanged
      return c;
    })
    .join('');
}

/**
 * Try Base64 decode with multiple variants
 */
function tryBase64(str: string): string | null {
  const variants = [
    str, // Original
    str.replace(/^=+/, ''), // Remove leading =
    str.replace(/=+$/, ''), // Remove trailing =
    str.replace(/^=+/, '').replace(/=+$/, ''), // Remove both
    str.replace(/_/g, '/').replace(/-/g, '+'), // URL-safe
    str.replace(/^=+/, '').replace(/_/g, '/').replace(/-/g, '+'), // Both
  ];

  for (const variant of variants) {
    try {
      const decoded = Buffer.from(variant, 'base64').toString('utf8');
      if (decoded && decoded.length > 0) return decoded;
    } catch {}
  }

  return null;
}

/**
 * Try reverse Base64 decode
 */
function tryReverseBase64(str: string): string | null {
  try {
    const reversed = str.split('').reverse().join('');
    return tryBase64(reversed);
  } catch {
    return null;
  }
}

/**
 * Try hex decode
 */
function tryHex(str: string): string | null {
  try {
    // First try replacing 'g' with '8' and ':' with '/'
    const withG = str.replace(/g/g, '8').replace(/:/g, '/');
    if (withG.includes('http')) return withG;

    // Try standard hex decode
    const cleaned = str.replace(/[^0-9a-fA-F]/g, '');
    if (cleaned.length % 2 !== 0) return null;
    const decoded = Buffer.from(cleaned, 'hex').toString('utf8');

    // Check if decoded result looks like a URL
    if (decoded.includes('http')) return decoded;

    return decoded;
  } catch {
    return null;
  }
}

/**
 * Fetch page with proper headers
 */
async function fetchPage(url: string, referer = 'https://vidsrc-embed.ru/'): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        Referer: referer,
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    throw new Error(`Failed to fetch ${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract CloudStream M3U8 URL
 */
export async function extractCloudStream(
  tmdbId: string,
  type: 'movie' | 'tv' = 'movie',
  season?: number,
  episode?: number
): Promise<ExtractionResult> {
  const logs: string[] = [];
  
  try {
    // Step 1: Fetch VidSrc embed page
    let embedUrl = `https://vidsrc-embed.ru/embed/${type}/${tmdbId}`;
    if (type === 'tv' && season && episode) {
      embedUrl += `/${season}/${episode}`;
    }
    
    logs.push(`[1] Fetching embed page: ${embedUrl}`);
    console.log(`[1] Fetching embed page: ${embedUrl}`);
    const embedPage = await fetchPage(embedUrl);
    logs.push(`[1] ✓ Embed page fetched (${embedPage.length} bytes)`);
    console.log(`[1] ✓ Embed page fetched (${embedPage.length} bytes)`);

    // Step 2: Extract hash
    const hashMatch = embedPage.match(/data-hash=["']([^"']+)["']/);
    if (!hashMatch) {
      const error = 'Hash not found in embed page';
      logs.push(`[2] ✗ ${error}`);
      console.error(`[2] ✗ ${error}`);
      return { success: false, error, logs };
    }
    const hash = hashMatch[1];
    logs.push(`[2] ✓ Hash extracted: ${hash}`);
    console.log(`[2] ✓ Hash extracted: ${hash}`);

    // Step 3: Fetch RCP page
    const rcpUrl = `https://cloudnestra.com/rcp/${hash}`;
    logs.push(`[3] Fetching RCP page: ${rcpUrl}`);
    console.log(`[3] Fetching RCP page: ${rcpUrl}`);
    const rcpPage = await fetchPage(rcpUrl, embedUrl);
    logs.push(`[3] ✓ RCP page fetched (${rcpPage.length} bytes)`);
    console.log(`[3] ✓ RCP page fetched (${rcpPage.length} bytes)`);

    // Step 4: Extract player URL
    let playerUrl: string | null = null;
    const patterns = [
      /\/prorcp\/([A-Za-z0-9+\/=\-_]+)/,
      /\/srcrcp\/([A-Za-z0-9+\/=\-_]+)/,
      /<iframe[^>]+src=["']([^"']+prorcp[^"']+)["']/i,
      /<iframe[^>]+src=["']([^"']+srcrcp[^"']+)["']/i,
      /src=["']([^"']*cloudnestra\.com[^"']+)["']/i,
    ];

    for (const pattern of patterns) {
      const match = rcpPage.match(pattern);
      if (match) {
        if (match[0].includes('iframe')) {
          playerUrl = match[1];
        } else {
          playerUrl = `https://cloudnestra.com/prorcp/${match[1]}`;
        }
        break;
      }
    }

    if (!playerUrl) {
      const error = 'Player URL not found';
      logs.push(`[4] ✗ ${error}`);
      console.error(`[4] ✗ ${error}`);
      return { success: false, error, logs };
    }
    logs.push(`[4] ✓ Player URL found: ${playerUrl}`);
    console.log(`[4] ✓ Player URL found: ${playerUrl}`);

    // Step 5: Fetch player page
    logs.push(`[5] Fetching player page: ${playerUrl}`);
    console.log(`[5] Fetching player page: ${playerUrl}`);
    const playerPage = await fetchPage(playerUrl, rcpUrl);
    logs.push(`[5] ✓ Player page fetched (${playerPage.length} bytes)`);
    console.log(`[5] ✓ Player page fetched (${playerPage.length} bytes)`);

    // Step 6: Extract hidden div
    const hiddenDivMatch = playerPage.match(
      /<div[^>]+id="([^"]+)"[^>]*style="display:\s*none;?"[^>]*>([^<]+)<\/div>/i
    );
    if (!hiddenDivMatch) {
      const error = 'Hidden div not found';
      logs.push(`[6] ✗ ${error}`);
      console.error(`[6] ✗ ${error}`);
      return { success: false, error, logs };
    }

    const divId = hiddenDivMatch[1];
    const encoded = hiddenDivMatch[2];
    logs.push(`[6] ✓ Hidden div found, divId: ${divId}, encoded length: ${encoded.length}`);
    console.log(`[6] ✓ Hidden div found, divId: ${divId}`);
    console.log(`[6] Encoded preview: ${encoded.substring(0, 100)}...`);
    console.log(`[6] Encoded last 20: ...${encoded.substring(encoded.length - 20)}`);

    // Step 7: Try all decoding methods
    let decoded: string | null = null;
    let usedDecoder: string | null = null;

    // Comprehensive list of all decoding methods
    const allMethods: Array<{ name: string; fn: (s: string) => string | null }> = [];

    // 1. Direct Caesar shifts (-25 to +25)
    for (let shift = -25; shift <= 25; shift++) {
      if (shift === 0) continue;
      allMethods.push({
        name: `Caesar ${shift}`,
        fn: (s) => caesarShift(s, shift),
      });
    }

    // 2. Base64 variants
    allMethods.push({ name: 'Base64', fn: (s) => tryBase64(s) });
    allMethods.push({ name: 'Reverse Base64', fn: (s) => tryReverseBase64(s) });

    // 3. Hex variants
    allMethods.push({ name: 'Hex', fn: (s) => tryHex(s) });
    allMethods.push({
      name: 'Hex (g=8, :=/)',
      fn: (s) => s.replace(/g/g, '8').replace(/:/g, '/'),
    });

    // 4. Base64 + Caesar combinations
    for (let shift = -25; shift <= 25; shift++) {
      if (shift === 0) continue;
      allMethods.push({
        name: `Base64 + Caesar ${shift}`,
        fn: (s) => {
          const b = tryBase64(s);
          return b ? caesarShift(b, shift) : null;
        },
      });
    }

    // 5. Reverse Base64 + Caesar combinations
    for (let shift = -25; shift <= 25; shift++) {
      if (shift === 0) continue;
      allMethods.push({
        name: `Reverse Base64 + Caesar ${shift}`,
        fn: (s) => {
          const b = tryReverseBase64(s);
          return b ? caesarShift(b, shift) : null;
        },
      });
    }

    // 6. Hex + Caesar combinations
    for (let shift = -25; shift <= 25; shift++) {
      if (shift === 0) continue;
      allMethods.push({
        name: `Hex + Caesar ${shift}`,
        fn: (s) => {
          const h = tryHex(s);
          return h ? caesarShift(h, shift) : null;
        },
      });
    }

    // 7. ROT13
    allMethods.push({
      name: 'ROT13',
      fn: (s) =>
        s.replace(/[a-zA-Z]/g, (c) => {
          const code = c.charCodeAt(0);
          const base = code >= 97 ? 97 : 65;
          return String.fromCharCode(((code - base + 13) % 26) + base);
        }),
    });

    // 8. Atbash (reverse alphabet)
    allMethods.push({
      name: 'Atbash',
      fn: (s) =>
        s
          .split('')
          .map((c) => {
            const code = c.charCodeAt(0);
            if (code >= 65 && code <= 90) return String.fromCharCode(90 - (code - 65));
            if (code >= 97 && code <= 122) return String.fromCharCode(122 - (code - 97));
            return c;
          })
          .join(''),
    });

    // Try all methods
    logs.push(`[7] Trying ${allMethods.length} decoder methods...`);
    console.log(`[7] Trying ${allMethods.length} decoder methods...`);
    console.log(`[7] Encoded data characteristics: length=${encoded.length}, starts with=${encoded.substring(0, 10)}`);
    
    // If encoded data is very long (>1000 chars), it's likely Base64 - try that first
    if (encoded.length > 1000) {
      logs.push(`[7] Long encoded data detected (${encoded.length} bytes), trying Base64 first...`);
      console.log(`[7] Long encoded data detected, trying Base64 first...`);
      
      try {
        const base64Decoded = Buffer.from(encoded, 'base64').toString('utf8');
        console.log(`[7] Base64 decoded to ${base64Decoded.length} bytes`);
        console.log(`[7] Base64 result preview: ${base64Decoded.substring(0, 100)}`);
        
        if (base64Decoded && (base64Decoded.includes('http://') || base64Decoded.includes('https://'))) {
          decoded = base64Decoded;
          usedDecoder = 'Base64';
          logs.push(`[7] ✓ Base64 decoder succeeded!`);
          console.log(`[7] ✓ Base64 decoder succeeded!`);
        }
      } catch (err) {
        console.log(`[7] Base64 decode failed:`, err);
      }
    }
    
    // If Base64 didn't work, try all other methods
    if (!decoded) {
      for (const method of allMethods) {
        try {
          const result = method.fn(encoded);
          if (result && (result.includes('http://') || result.includes('https://'))) {
            decoded = result;
            usedDecoder = method.name;
            logs.push(`[7] ✓ Decoder succeeded: ${method.name}`);
            console.log(`[7] ✓ Decoder succeeded: ${method.name}`);
            console.log(`[7] Decoded URL: ${result}`);
            break;
          }
        } catch (err) {
          // Silent fail, try next method
        }
      }
    }

    if (!decoded) {
      const error = `All ${allMethods.length} decoders failed`;
      logs.push(`[7] ✗ ${error}`);
      console.error(`[7] ✗ ${error}`);
      console.error(`[7] Encoded data was: ${encoded}`);
      return { success: false, error, logs };
    }

    // Step 8: Resolve CDN placeholders
    logs.push(`[8] Resolving CDN placeholders...`);
    console.log(`[8] Resolving CDN placeholders...`);
    
    const cdnMappings: Record<string, string> = {
      '{v1}': 'shadowlandschronicles.com',
      '{v2}': 'shadowlandschronicles.net',
      '{v3}': 'shadowlandschronicles.io',
      '{v4}': 'shadowlandschronicles.org',
      '{s1}': 'com',
      '{s2}': 'net',
      '{s3}': 'io',
      '{s4}': 'org',
    };

    let resolved = decoded;
    for (const [placeholder, replacement] of Object.entries(cdnMappings)) {
      resolved = resolved.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), replacement);
    }

    logs.push(`[8] ✓ Placeholders resolved`);
    console.log(`[8] ✓ Final URL: ${resolved}`);
    
    // Step 9: Extract M3U8 URL
    const m3u8Match = resolved.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);

    if (!m3u8Match) {
      const error = 'M3U8 URL not found in decoded data';
      logs.push(`[9] ✗ ${error}`);
      console.error(`[9] ✗ ${error}`);
      console.error(`[9] Resolved data was: ${resolved}`);
      return { success: false, error, logs };
    }

    const finalUrl = m3u8Match[0];
    logs.push(`[9] ✓ M3U8 URL extracted: ${finalUrl}`);
    logs.push(`[✓] SUCCESS - Method: ${usedDecoder}`);
    console.log(`[9] ✓ M3U8 URL extracted: ${finalUrl}`);
    console.log(`[✓] SUCCESS - Method: ${usedDecoder}`);

    return {
      success: true,
      url: finalUrl,
      method: usedDecoder || 'unknown',
      logs,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logs.push(`[✗] FATAL ERROR: ${errorMsg}`);
    console.error(`[✗] FATAL ERROR:`, error);
    return { success: false, error: errorMsg, logs };
  }
}
