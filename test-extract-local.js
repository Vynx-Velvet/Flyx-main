/**
 * LOCAL TEST SCRIPT FOR STREAM EXTRACTION
 * Run with: node test-extract-local.js
 */

const TMDB_ID = '1054867'; // The movie we're testing

async function fetchPage(url, referer = 'https://vidsrc-embed.ru/') {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': referer,
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    throw new Error(`Failed to fetch ${url}: ${error.message}`);
  }
}

function caesarShift(text, shift) {
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

async function extractStream() {
  console.log('='.repeat(80));
  console.log('CLOUDSTREAM EXTRACTION TEST');
  console.log('='.repeat(80));
  console.log(`TMDB ID: ${TMDB_ID}\n`);

  try {
    // Step 1: Fetch embed page
    console.log('[1] Fetching embed page...');
    const embedUrl = `https://vidsrc-embed.ru/embed/movie/${TMDB_ID}`;
    const embedPage = await fetchPage(embedUrl);
    console.log(`[1] ✓ Fetched ${embedPage.length} bytes\n`);

    // Step 2: Extract hash
    console.log('[2] Extracting hash...');
    const hashMatch = embedPage.match(/data-hash=["']([^"']+)["']/);
    if (!hashMatch) throw new Error('Hash not found');
    const hash = hashMatch[1];
    console.log(`[2] ✓ Hash: ${hash.substring(0, 50)}...\n`);

    // Step 3: Fetch RCP page
    console.log('[3] Fetching RCP page...');
    const rcpUrl = `https://cloudnestra.com/rcp/${hash}`;
    const rcpPage = await fetchPage(rcpUrl, embedUrl);
    console.log(`[3] ✓ Fetched ${rcpPage.length} bytes\n`);

    // Step 4: Extract player URL
    console.log('[4] Extracting player URL...');
    const patterns = [
      /\/prorcp\/([A-Za-z0-9+\/=\-_]+)/,
      /\/srcrcp\/([A-Za-z0-9+\/=\-_]+)/,
    ];

    let playerUrl = null;
    for (const pattern of patterns) {
      const match = rcpPage.match(pattern);
      if (match) {
        playerUrl = `https://cloudnestra.com/prorcp/${match[1]}`;
        break;
      }
    }

    if (!playerUrl) {
      console.log('[4] ✗ Player URL not found in initial patterns');
      console.log('[4] Saving full RCP page to rcp-page-debug.html for analysis...');
      require('fs').writeFileSync('rcp-page-debug.html', rcpPage);
      console.log('[4] Searching for alternative patterns...');
      
      // Try to find any cloudnestra URLs
      const cloudnestraUrls = rcpPage.match(/https?:\/\/[^"'\s]*cloudnestra\.com[^"'\s]*/gi);
      console.log('Cloudnestra URLs found:', cloudnestraUrls);
      
      // Try to find base64 encoded data that might be a URL
      const base64Patterns = rcpPage.match(/[A-Za-z0-9+\/]{100,}={0,2}/g);
      console.log('Long base64 strings found:', base64Patterns ? base64Patterns.length : 0);
      
      throw new Error('Player URL not found - site may have Cloudflare protection');
    }
    console.log(`[4] ✓ Player URL: ${playerUrl.substring(0, 80)}...\n`);

    // Step 5: Fetch player page
    console.log('[5] Fetching player page...');
    const playerPage = await fetchPage(playerUrl, rcpUrl);
    console.log(`[5] ✓ Fetched ${playerPage.length} bytes\n`);

    // Step 6: Extract hidden div
    console.log('[6] Extracting hidden div...');
    const hiddenDivMatch = playerPage.match(
      /<div[^>]+id="([^"]+)"[^>]*style="display:\s*none;?"[^>]*>([^<]+)<\/div>/i
    );
    if (!hiddenDivMatch) throw new Error('Hidden div not found');

    const divId = hiddenDivMatch[1];
    const encoded = hiddenDivMatch[2];
    console.log(`[6] ✓ Div ID: ${divId}`);
    console.log(`[6] ✓ Encoded length: ${encoded.length}`);
    console.log(`[6] Encoded preview: ${encoded.substring(0, 100)}...\n`);

    // Step 7: Try decoding
    console.log('[7] Trying decoders...');
    console.log(`[7] Encoded starts with: ${encoded.substring(0, 20)}`);
    console.log(`[7] Encoded ends with: ...${encoded.substring(encoded.length - 20)}\n`);

    let decoded = null;
    let method = null;

    // Try Base64 decode
    console.log('[7.1] Trying Base64 decode...');
    try {
      const base64Decoded = Buffer.from(encoded, 'base64').toString('utf8');
      console.log(`[7.1] Base64 decoded to ${base64Decoded.length} bytes`);
      console.log(`[7.1] Base64 result preview: ${base64Decoded.substring(0, 100)}`);
      console.log(`[7.1] Base64 result ends: ...${base64Decoded.substring(base64Decoded.length - 50)}\n`);

      // Check if it contains http directly
      if (base64Decoded.includes('http://') || base64Decoded.includes('https://')) {
        decoded = base64Decoded;
        method = 'Base64';
        console.log('[7.1] ✓ Base64 alone worked!\n');
      } else {
        // Try double Base64
        console.log('[7.2] Trying double Base64...');
        try {
          const doubleBase64 = Buffer.from(base64Decoded, 'base64').toString('utf8');
          console.log(`[7.2] Double Base64 decoded to ${doubleBase64.length} bytes`);
          console.log(`[7.2] Double Base64 preview: ${doubleBase64.substring(0, 100)}\n`);

          if (doubleBase64.includes('http://') || doubleBase64.includes('https://')) {
            decoded = doubleBase64;
            method = 'Double Base64';
            console.log('[7.2] ✓ Double Base64 worked!\n');
          } else {
            // Try double Base64 + Caesar
            console.log('[7.3] Trying double Base64 + Caesar shifts...');
            const shifts = [3, -3, 1, -1, 2, -2, 4, -4, 5, -5, 6, -6, 7, -7, 8, -8, 9, -9, 10, -10];
            for (const shift of shifts) {
              const caesarResult = caesarShift(doubleBase64, shift);
              console.log(`[7.3.${shift}] Caesar ${shift}: ${caesarResult.substring(0, 50)}...`);

              if (caesarResult.includes('http://') || caesarResult.includes('https://')) {
                decoded = caesarResult;
                method = `Double Base64 + Caesar ${shift}`;
                console.log(`[7.3.${shift}] ✓ Double Base64 + Caesar ${shift} worked!\n`);
                break;
              }
            }
          }
        } catch (err) {
          console.log(`[7.2] Double Base64 failed: ${err.message}\n`);
        }

        // If double Base64 didn't work, try single Base64 + Caesar
        if (!decoded) {
          console.log('[7.4] Trying single Base64 + Caesar shifts...');
          const shifts = [3, -3, 1, -1, 2, -2, 4, -4, 5, -5, 6, -6, 7, -7, 8, -8, 9, -9, 10, -10];
          for (const shift of shifts) {
            const caesarResult = caesarShift(base64Decoded, shift);
            console.log(`[7.4.${shift}] Caesar ${shift}: ${caesarResult.substring(0, 50)}...`);

            if (caesarResult.includes('http://') || caesarResult.includes('https://')) {
              decoded = caesarResult;
              method = `Base64 + Caesar ${shift}`;
              console.log(`[7.4.${shift}] ✓ Base64 + Caesar ${shift} worked!\n`);
              break;
            }
          }
        }
      }
    } catch (err) {
      console.log(`[7.1] Base64 decode failed: ${err.message}\n`);
    }

    if (!decoded) {
      console.log('[7] ✗ All decoders failed\n');
      console.log('FULL ENCODED DATA:');
      console.log(encoded);
      process.exit(1);
    }

    // Step 8: Resolve placeholders
    console.log('[8] Resolving CDN placeholders...');
    console.log(`[8] Decoded URL: ${decoded}\n`);

    const cdnMappings = {
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

    console.log(`[8] ✓ Resolved: ${resolved}\n`);

    // Step 9: Extract M3U8 URL
    console.log('[9] Extracting M3U8 URL...');
    const m3u8Match = resolved.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);

    if (!m3u8Match) {
      console.log('[9] ✗ M3U8 URL not found in resolved data');
      console.log('Resolved data:', resolved);
      process.exit(1);
    }

    const finalUrl = m3u8Match[0];
    console.log(`[9] ✓ M3U8 URL: ${finalUrl}\n`);

    console.log('='.repeat(80));
    console.log('SUCCESS!');
    console.log('='.repeat(80));
    console.log(`Method: ${method}`);
    console.log(`URL: ${finalUrl}`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('ERROR:', error.message);
    console.error('='.repeat(80));
    process.exit(1);
  }
}

extractStream();
