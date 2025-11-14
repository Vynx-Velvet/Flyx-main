const https = require('https');
const TMDB_ID = '550';

async function extractCloudStreamM3U8() {
  console.log('CLOUDSTREAM M3U8 EXTRACTOR');
  console.log('TMDB ID:', TMDB_ID);

  try {
    console.log('Step 1: Fetching VidSrc embed page...');
    const embedUrl = `https://vidsrc-embed.ru/embed/movie/${TMDB_ID}`;
    const embedPage = await fetchPage(embedUrl);
    console.log('Fetched', embedPage.length, 'bytes');

    console.log('Step 2: Extracting hash...');
    const hashMatch = embedPage.match(/data-hash=["']([^"']+)["']/);
    if (!hashMatch) throw new Error('Hash not found');
    const hash = hashMatch[1];
    console.log('Hash:', hash);

    console.log('Step 3: Fetching RCP page...');
    const rcpUrl = `https://cloudnestra.com/rcp/${hash}`;
    const rcpPage = await fetchPage(rcpUrl, embedUrl);
    console.log('Fetched', rcpPage.length, 'bytes');

    console.log('Step 4: Extracting player URL...');
    
    // Try multiple patterns for player URL
    let playerUrl = null;
    const patterns = [
      /\/prorcp\/([A-Za-z0-9+\/=\-_]+)/,
      /\/srcrcp\/([A-Za-z0-9+\/=\-_]+)/,
      /<iframe[^>]+src=["']([^"']+prorcp[^"']+)["']/i,
      /<iframe[^>]+src=["']([^"']+srcrcp[^"']+)["']/i,
      /src=["']([^"']*cloudnestra\.com[^"']+)["']/i
    ];
    
    for (const pattern of patterns) {
      const match = rcpPage.match(pattern);
      if (match) {
        if (match[0].includes('iframe')) {
          playerUrl = match[1];
        } else {
          playerUrl = `https://cloudnestra.com/prorcp/${match[1]}`;
        }
        console.log('Found player URL:', playerUrl.substring(0, 80));
        break;
      }
    }
    
    if (!playerUrl) {
      console.log('RCP page preview:', rcpPage.substring(0, 1000));
      throw new Error('Player URL not found');
    }

    console.log('Step 5: Fetching player page...');
    const playerPage = await fetchPage(playerUrl, rcpUrl);
    console.log('Fetched', playerPage.length, 'bytes');

    console.log('Step 6: Extracting hidden div...');
    const hiddenDivMatch = playerPage.match(/<div[^>]+id="([^"]+)"[^>]*style="display:\s*none;?"[^>]*>([^<]+)<\/div>/i);
    if (!hiddenDivMatch) throw new Error('Hidden div not found');
    const divId = hiddenDivMatch[1];
    const encoded = hiddenDivMatch[2];
    console.log('Div ID:', divId);
    console.log('Encoded length:', encoded.length);

    console.log('Step 7: Trying decoders...');
    console.log('Encoded preview:', encoded.substring(0, 100));
    console.log('Encoded full length:', encoded.length);
    console.log('First 20 chars:', encoded.substring(0, 20));
    console.log('Last 20 chars:', encoded.substring(encoded.length - 20));
    
    let decoded = null;
    let usedDecoder = null;
    
    // Comprehensive list of all decoding methods
    const allMethods = [];
    
    // 1. Direct Caesar shifts (-25 to +25)
    for (let shift = -25; shift <= 25; shift++) {
      if (shift === 0) continue;
      allMethods.push({
        name: `Caesar ${shift}`,
        fn: (s) => caesarShift(s, shift)
      });
    }
    
    // 2. Base64 variants
    allMethods.push({ name: 'Base64', fn: (s) => tryBase64(s) });
    allMethods.push({ name: 'Reverse Base64', fn: (s) => tryReverseBase64(s) });
    
    // 3. Hex variants
    allMethods.push({ name: 'Hex', fn: (s) => tryHex(s) });
    allMethods.push({ name: 'Hex (g=8, :=/)', fn: (s) => s.replace(/g/g, '8').replace(/:/g, '/') });
    
    // 4. Base64 + Caesar combinations
    for (let shift = -25; shift <= 25; shift++) {
      if (shift === 0) continue;
      allMethods.push({
        name: `Base64 + Caesar ${shift}`,
        fn: (s) => { const b = tryBase64(s); return b ? caesarShift(b, shift) : null; }
      });
    }
    
    // 5. Reverse Base64 + Caesar combinations
    for (let shift = -25; shift <= 25; shift++) {
      if (shift === 0) continue;
      allMethods.push({
        name: `Reverse Base64 + Caesar ${shift}`,
        fn: (s) => { const b = tryReverseBase64(s); return b ? caesarShift(b, shift) : null; }
      });
    }
    
    // 6. Hex + Caesar combinations
    for (let shift = -25; shift <= 25; shift++) {
      if (shift === 0) continue;
      allMethods.push({
        name: `Hex + Caesar ${shift}`,
        fn: (s) => { const h = tryHex(s); return h ? caesarShift(h, shift) : null; }
      });
    }
    
    // 7. ROT13
    allMethods.push({
      name: 'ROT13',
      fn: (s) => s.replace(/[a-zA-Z]/g, c => {
        const code = c.charCodeAt(0);
        const base = code >= 97 ? 97 : 65;
        return String.fromCharCode(((code - base + 13) % 26) + base);
      })
    });
    
    // 8. Atbash (reverse alphabet)
    allMethods.push({
      name: 'Atbash',
      fn: (s) => s.split('').map(c => {
        const code = c.charCodeAt(0);
        if (code >= 65 && code <= 90) return String.fromCharCode(90 - (code - 65));
        if (code >= 97 && code <= 122) return String.fromCharCode(122 - (code - 97));
        return c;
      }).join('')
    });
    
    // Try all methods
    for (const method of allMethods) {
      try {
        const result = method.fn(encoded);
        if (result && (result.includes('http://') || result.includes('https://'))) {
          decoded = result;
          usedDecoder = method.name;
          console.log('SUCCESS with', method.name);
          break;
        }
      } catch (e) {}
    }

    if (!decoded) {
      console.log('Tried', allMethods.length, 'decoding methods');
      throw new Error('All decoders failed');
    }
    console.log('Decoded preview:', decoded.substring(0, 100));

    console.log('Step 8: Resolving CDN placeholders...');
    const cdnMappings = {
      '{v1}': 'shadowlandschronicles.com',
      '{v2}': 'shadowlandschronicles.net',
      '{v3}': 'shadowlandschronicles.io',
      '{v4}': 'shadowlandschronicles.org',
      '{s1}': 'com',
      '{s2}': 'net',
      '{s3}': 'io',
      '{s4}': 'org'
    };

    let resolved = decoded;
    for (const [placeholder, replacement] of Object.entries(cdnMappings)) {
      resolved = resolved.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), replacement);
    }
    console.log('Placeholders resolved');

    console.log('Step 9: Extracting M3U8 URL...');
    const m3u8Match = resolved.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);
    if (!m3u8Match) {
      console.log('No M3U8 found in:', resolved);
      throw new Error('M3U8 not found');
    }

    const m3u8Url = m3u8Match[0];
    console.log('');
    console.log('SUCCESS!');
    console.log('Decoder used:', usedDecoder);
    console.log('M3U8 URL:', m3u8Url);
    return m3u8Url;

  } catch (error) {
    console.error('ERROR:', error.message);
    throw error;
  }
}

function caesarShift(text, shift) {
  return text.split('').map(c => {
    const code = c.charCodeAt(0);
    if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + shift + 26) % 26) + 65);
    if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + shift + 26) % 26) + 97);
    return c;
  }).join('');
}

function tryBase64(str) {
  const variants = [
    str,                                          // Original
    str.replace(/^=+/, ''),                      // Remove leading =
    str.replace(/=+$/, ''),                      // Remove trailing =
    str.replace(/^=+/, '').replace(/=+$/, ''),  // Remove both
    str.replace(/_/g, '/').replace(/-/g, '+'),  // URL-safe
    str.replace(/^=+/, '').replace(/_/g, '/').replace(/-/g, '+')  // Both
  ];
  
  for (const variant of variants) {
    try {
      const decoded = Buffer.from(variant, 'base64').toString('utf8');
      if (decoded && decoded.length > 0) return decoded;
    } catch {}
  }
  
  return null;
}

function tryReverseBase64(str) {
  try {
    const reversed = str.split('').reverse().join('');
    return Buffer.from(reversed, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

function tryHex(str) {
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

function fetchPage(url, referer = 'https://vidsrc-embed.ru/') {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': referer,
        'Connection': 'keep-alive'
      }
    }, res => {
      let data = '';
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchPage(res.headers.location, referer).then(resolve).catch(reject);
      }
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

extractCloudStreamM3U8().then(() => process.exit(0)).catch(() => process.exit(1));
