/**
 * Test vidsrc-embed.ru prorcp decoder against multiple movies/shows
 * With 5 second delay between each to avoid Cloudflare
 * 
 * Flow: vidsrc-embed.ru -> cloudnestra.com/prorcp -> decode stream
 */

const https = require('https');
const http = require('http');

// Domain for placeholders - as specified by user
const DOMAIN = 'shadowlandschronicles.com';

// Test media - mix of movies and TV shows
const TEST_MEDIA = [
    { type: 'movie', tmdbId: '550', title: 'Fight Club' },
    { type: 'tv', tmdbId: '1396', season: 1, episode: 1, title: 'Breaking Bad S01E01' },
    { type: 'movie', tmdbId: '680', title: 'Pulp Fiction' }
];

// NEW format decoder - ROT3 on alphanumeric characters only (eqqmp:// format)
function decodeNewFormat(str) {
    return str.split('').map(c => {
        const code = c.charCodeAt(0);
        if (code >= 97 && code <= 122) {
            return String.fromCharCode(((code - 97 + 3) % 26) + 97);
        }
        if (code >= 65 && code <= 90) {
            return String.fromCharCode(((code - 65 + 3) % 26) + 65);
        }
        if (code >= 48 && code <= 57) {
            return String.fromCharCode(((code - 48 + 3) % 10) + 48);
        }
        return c;
    }).join('');
}

// OLD format decoder (reverse → subtract 1 → hex decode)
// Used with div ID eSfH1IRMyL
function decodeOldFormat(str) {
    // Step 1: Reverse the string
    const reversed = str.split('').reverse().join('');
    
    // Step 2: Subtract 1 from each character
    let adjusted = '';
    for (let i = 0; i < reversed.length; i++) {
        adjusted += String.fromCharCode(reversed.charCodeAt(i) - 1);
    }
    
    // Step 3: Convert hex pairs to ASCII
    let decoded = '';
    for (let i = 0; i < adjusted.length; i += 2) {
        const hexPair = adjusted.substr(i, 2);
        const charCode = parseInt(hexPair, 16);
        if (!isNaN(charCode)) {
            decoded += String.fromCharCode(charCode);
        }
    }
    
    return decoded;
}

// Base64 format decoder (reverse + base64 + subtract shift)
// The shift value can vary (3, 5, or 7), and may have = at position 0 or 1 to strip
function decodeBase64Format(str) {
    // Try different input variations
    const variations = [
        { input: str, desc: 'original' },
        { input: str.substring(1), desc: 'strip-first' },
        { input: str.startsWith('=') ? str.substring(1) : str, desc: 'strip-eq-prefix' },
        { input: str.charAt(1) === '=' ? str.substring(2) : str, desc: 'strip-after-eq' },
    ];
    
    for (const { input, desc } of variations) {
        try {
            let reversed = input.split('').reverse().join('');
            let replaced = reversed.replace(/-/g, '+').replace(/_/g, '/');
            let decodedB64 = Buffer.from(replaced, 'base64').toString('binary');
            
            // Try different shift values
            for (const shift of [7, 5, 3, 4, 6, 2, 8, 9]) {
                let result = '';
                for (let i = 0; i < decodedB64.length; i++) {
                    result += String.fromCharCode(decodedB64.charCodeAt(i) - shift);
                }
                if (result.includes('https://') && result.includes('.m3u8')) {
                    return { decoded: result, shift, variation: desc };
                }
            }
        } catch (e) {
            // Try next variation
        }
    }
    
    return null; // Failed to decode
}

// Replace placeholders with actual domain
function replacePlaceholders(url) {
    return url
        .replace(/\{v1\}/g, DOMAIN)
        .replace(/\{v2\}/g, DOMAIN)
        .replace(/\{v3\}/g, DOMAIN)
        .replace(/\{v4\}/g, DOMAIN);
}

// Fetch URL with proper headers
function fetchUrl(url, referer = 'https://vidsrc-embed.ru/') {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const client = urlObj.protocol === 'https:' ? https : http;
        
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Referer': referer,
                'Origin': 'https://vidsrc-embed.ru'
            }
        };

        const req = client.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
        });

        req.on('error', reject);
        req.setTimeout(15000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.end();
    });
}

// Build vidsrc-embed URL
function buildEmbedUrl(media) {
    if (media.type === 'movie') {
        return `https://vidsrc-embed.ru/embed/movie/${media.tmdbId}`;
    } else {
        return `https://vidsrc-embed.ru/embed/tv/${media.tmdbId}/${media.season}/${media.episode}`;
    }
}

// Extract RCP URL from embed page (first step)
function extractRcpUrl(html) {
    // Look for iframe src with /rcp/ URL
    const iframeMatch = html.match(/src="([^"]*\/rcp\/[^"]+)"/);
    if (iframeMatch) {
        let url = iframeMatch[1];
        if (url.startsWith('//')) url = 'https:' + url;
        return url;
    }
    
    // Check for data-hash attribute (CloudStream Pro server)
    const hashMatch = html.match(/data-hash="([^"]+)"[^>]*>CloudStream Pro/);
    if (hashMatch) return `https://cloudnestra.com/rcp/${hashMatch[1]}`;
    
    return null;
}

// Extract prorcp URL from RCP page (second step)
function extractProrcpUrl(html) {
    // Look for /prorcp/ URL in the page
    const match = html.match(/src:\s*['"]([^'"]*\/prorcp\/[^'"]+)['"]/);
    if (match) return match[1];
    
    // Also check for direct iframe src
    const iframeMatch = html.match(/src=['"]([^'"]*\/prorcp\/[^'"]+)['"]/);
    if (iframeMatch) return iframeMatch[1];
    
    return null;
}

// Detect encoding format
function detectFormat(encoded, divId) {
    const first20 = encoded.substring(0, 20);
    
    // Check for ROT3 format (starts with eqqmp://)
    if (encoded.startsWith('eqqmp://')) return 'ROT3';
    
    // Check for OLD format (div ID eSfH1IRMyL, contains colons)
    if (divId === 'eSfH1IRMyL' || encoded.includes(':')) return 'OLD';
    
    // Check for HEX format (pure hex characters)
    if (/^[0-9a-f]+$/i.test(first20)) return 'HEX';
    
    // Check for BASE64 format
    if (/^[A-Za-z0-9+/=_-]+$/.test(first20)) return 'BASE64';
    
    return 'UNKNOWN';
}

// Extract stream URL from prorcp page
function extractStreamFromProrcp(html) {
    // Method 1: Direct video src
    const videoMatch = html.match(/<video[^>]*src="([^"]+)"/);
    if (videoMatch) {
        return { method: 'video-src', url: videoMatch[1] };
    }

    // Method 2: Look for hidden div with encoded content
    const divMatch = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
    if (divMatch && divMatch[2].length > 50) {
        const divId = divMatch[1];
        const encoded = divMatch[2];
        const format = detectFormat(encoded, divId);
        
        console.log(`   Detected format: ${format}, Div ID: ${divId}`);
        
        if (format === 'ROT3') {
            // ROT3 format - simple character rotation
            const decoded = decodeNewFormat(encoded);
            const urls = decoded.split(' or ').map(u => replacePlaceholders(u.trim()));
            return { method: 'rot3', urls, divId, format };
        } else if (format === 'OLD') {
            // OLD format - reverse → subtract 1 → hex decode
            try {
                const decoded = decodeOldFormat(encoded);
                if (decoded.includes('http') || decoded.includes('.m3u8')) {
                    const urls = decoded.split(' or ').map(u => replacePlaceholders(u.trim()));
                    return { method: 'old-format', urls, divId, format };
                } else {
                    return { method: 'old-format-no-urls', divId, format };
                }
            } catch (e) {
                return { method: 'old-format-error', error: e.message, divId, format };
            }
        } else if (format === 'BASE64') {
            // Base64 format - reverse + base64 + subtract shift
            try {
                const result = decodeBase64Format(encoded);
                if (result && (result.decoded.includes('http') || result.decoded.includes('.m3u8'))) {
                    const urls = result.decoded.split(' or ').map(u => replacePlaceholders(u.trim()));
                    const method = `base64-${result.variation}-shift${result.shift}`;
                    return { method, urls, divId, format };
                } else {
                    return { method: 'base64-no-urls', divId, format, 
                             note: 'Could not decode with any known variation' };
                }
            } catch (e) {
                return { method: 'base64-decode-error', error: e.message, divId, format };
            }
        } else if (format === 'HEX') {
            // HEX format - requires obfuscated JS decoder (not implemented)
            return { method: 'hex-not-supported', divId, format, 
                     note: 'HEX format requires browser-based decryption' };
        }
    }

    // Method 3: Look for m3u8 URLs directly
    const m3u8Match = html.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/g);
    if (m3u8Match) {
        return { method: 'm3u8-direct', urls: m3u8Match };
    }

    return { method: 'not-found' };
}

// Sleep function
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Test a single media item
async function testMedia(media, index) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${index + 1}/${TEST_MEDIA.length}] Testing: ${media.title}`);
    console.log(`Type: ${media.type}, TMDB ID: ${media.tmdbId}`);
    console.log('='.repeat(60));

    const embedUrl = buildEmbedUrl(media);
    console.log(`Step 1: Fetching embed page: ${embedUrl}`);

    try {
        // Step 1: Fetch embed page
        const embedResponse = await fetchUrl(embedUrl);
        console.log(`   Status: ${embedResponse.status}, Size: ${embedResponse.data.length} bytes`);

        if (embedResponse.status !== 200) {
            console.log('❌ Failed to fetch embed page');
            return { success: false, error: `HTTP ${embedResponse.status}` };
        }

        // Step 2: Extract RCP URL
        const rcpUrl = extractRcpUrl(embedResponse.data);
        if (!rcpUrl) {
            console.log('❌ Could not find RCP URL in embed page');
            const fs = require('fs');
            fs.writeFileSync(`debug-embed-${media.tmdbId}.html`, embedResponse.data);
            console.log(`   Saved to debug-embed-${media.tmdbId}.html`);
            return { success: false, error: 'No RCP URL found' };
        }
        
        console.log(`   ⏳ Waiting 5 seconds before RCP request...`);
        await sleep(5000);
        
        console.log(`Step 2: Fetching RCP page: ${rcpUrl.substring(0, 80)}...`);
        const rcpResponse = await fetchUrl(rcpUrl, embedUrl);
        console.log(`   Status: ${rcpResponse.status}, Size: ${rcpResponse.data.length} bytes`);

        if (rcpResponse.status !== 200) {
            console.log('❌ Failed to fetch RCP page');
            return { success: false, error: `RCP HTTP ${rcpResponse.status}` };
        }

        // Step 3: Extract prorcp URL from RCP page
        const prorcpPath = extractProrcpUrl(rcpResponse.data);
        if (!prorcpPath) {
            console.log('❌ Could not find prorcp URL in RCP page');
            const fs = require('fs');
            fs.writeFileSync(`debug-rcp-${media.tmdbId}.html`, rcpResponse.data);
            console.log(`   Saved to debug-rcp-${media.tmdbId}.html`);
            return { success: false, error: 'No prorcp URL found' };
        }

        // Build full prorcp URL
        const prorcpUrl = prorcpPath.startsWith('http') 
            ? prorcpPath 
            : `https://cloudnestra.com${prorcpPath}`;
        
        console.log(`   ⏳ Waiting 5 seconds before prorcp request...`);
        await sleep(5000);
        
        console.log(`Step 3: Fetching prorcp page: ${prorcpUrl.substring(0, 80)}...`);
        const prorcpResponse = await fetchUrl(prorcpUrl, rcpUrl);
        console.log(`   Status: ${prorcpResponse.status}, Size: ${prorcpResponse.data.length} bytes`);

        if (prorcpResponse.status !== 200) {
            console.log('❌ Failed to fetch prorcp page');
            return { success: false, error: `Prorcp HTTP ${prorcpResponse.status}` };
        }

        // Step 4: Extract stream URL
        const result = extractStreamFromProrcp(prorcpResponse.data);
        console.log(`Step 4: Extraction method: ${result.method}`);

        if (result.url) {
            console.log(`✅ Stream URL found:`);
            console.log(`   ${result.url.substring(0, 100)}...`);
            return { success: true, url: result.url, method: result.method };
        } else if (result.urls) {
            console.log(`✅ Found ${result.urls.length} stream URL(s):`);
            result.urls.slice(0, 3).forEach((u, i) => {
                console.log(`   [${i + 1}] ${u.substring(0, 80)}...`);
            });
            return { success: true, urls: result.urls, method: result.method };
        } else {
            console.log('❌ No stream URL found in prorcp page');
            const fs = require('fs');
            fs.writeFileSync(`debug-prorcp-${media.tmdbId}.html`, prorcpResponse.data);
            console.log(`   Saved to debug-prorcp-${media.tmdbId}.html`);
            return { success: false, error: 'No stream URL in prorcp' };
        }
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// Main function
async function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║   VIDSRC-EMBED.RU PRORCP DECODER TEST                       ║');
    console.log('║   Domain: ' + DOMAIN.padEnd(46) + '║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    const results = [];

    for (let i = 0; i < TEST_MEDIA.length; i++) {
        if (i > 0) {
            console.log(`\n⏳ Waiting 5 seconds before next request...`);
            await sleep(5000);
        }

        const result = await testMedia(TEST_MEDIA[i], i);
        results.push({ media: TEST_MEDIA[i], ...result });
    }

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('SUMMARY');
    console.log('═'.repeat(60));
    
    const successful = results.filter(r => r.success).length;
    console.log(`Total: ${results.length}, Success: ${successful}, Failed: ${results.length - successful}`);
    
    results.forEach((r, i) => {
        const status = r.success ? '✅' : '❌';
        console.log(`${status} ${r.media.title}: ${r.success ? r.method : r.error}`);
    });
}

main().catch(console.error);
