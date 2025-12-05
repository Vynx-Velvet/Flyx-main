/**
 * Test prorcp decoder against multiple movies/shows
 * With 5 second delay between each to avoid Cloudflare
 * 
 * Flow: 2embed.cc -> streamsrcs.2embed.cc -> prorcp page -> decode stream
 */

const https = require('https');
const http = require('http');

// Domain for placeholders
const DOMAIN = 'shadowlandschronicles.com';

// Test media - mix of movies and TV shows
const TEST_MEDIA = [
    { type: 'movie', tmdbId: '550', title: 'Fight Club' },
    { type: 'tv', tmdbId: '1396', season: 1, episode: 1, title: 'Breaking Bad S01E01' },
    { type: 'movie', tmdbId: '680', title: 'Pulp Fiction' }
];

// Decoder function
function decodeProrcp(str) {
    // 1. Reverse
    let reversed = str.split('').reverse().join('');
    // 2. Replace URL-safe base64 chars
    let replaced = reversed.replace(/-/g, '+').replace(/_/g, '/');
    // 3. Base64 decode
    let decodedB64 = Buffer.from(replaced, 'base64').toString('binary');
    // 4. Subtract 3 from each char code
    let result = '';
    for (let i = 0; i < decodedB64.length; i++) {
        result += String.fromCharCode(decodedB64.charCodeAt(i) - 3);
    }
    return result;
}

// Replace placeholders with actual domain
function replacePlaceholders(url) {
    return url
        .replace(/\{v1\}/g, DOMAIN)
        .replace(/\{v2\}/g, DOMAIN)
        .replace(/\{v3\}/g, DOMAIN)
        .replace(/\{v4\}/g, DOMAIN);
}

// Extract swish ID from 2embed page
function extractSwishId(html) {
    // Look for iframe data-src with swish ID
    const match = html.match(/streamsrcs\.2embed\.cc\/swish\?id=([^&"']+)/);
    if (match) return match[1];
    
    // Also check for vpls URL
    const vplsMatch = html.match(/streamsrcs\.2embed\.cc\/vpls\?tmdb=(\d+)/);
    if (vplsMatch) return { type: 'vpls', tmdbId: vplsMatch[1] };
    
    return null;
}

// Fetch URL with proper headers
function fetchUrl(url) {
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
                'Referer': 'https://www.2embed.cc/',
            }
        };

        const req = client.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        });

        req.on('error', reject);
        req.setTimeout(15000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.end();
    });
}

// Build prorcp URL
function buildProrcpUrl(media) {
    const baseUrl = 'https://www.2embed.cc/embedtv';
    if (media.type === 'movie') {
        return `https://www.2embed.cc/embed/${media.tmdbId}`;
    } else {
        return `https://www.2embed.cc/embedtv/${media.tmdbId}&s=${media.season}&e=${media.episode}`;
    }
}

// Extract stream URL from HTML
function extractStreamUrl(html) {
    // Method 1: Direct video src
    const videoMatch = html.match(/<video[^>]*src="([^"]+)"/);
    if (videoMatch) {
        return { method: 'video-src', url: videoMatch[1] };
    }

    // Method 2: Encoded div content
    const divMatch = html.match(/<div id="JoAHUMCLXV"[^>]*>([^<]+)<\/div>/);
    if (divMatch) {
        try {
            const decoded = decodeProrcp(divMatch[1]);
            const urls = decoded.split(' or ').map(u => replacePlaceholders(u.trim()));
            return { method: 'decoded-div', urls };
        } catch (e) {
            return { method: 'decode-error', error: e.message };
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

    const url = buildProrcpUrl(media);
    console.log(`URL: ${url}`);

    try {
        console.log('Fetching page...');
        const response = await fetchUrl(url);
        console.log(`Status: ${response.status}`);
        console.log(`Response size: ${response.data.length} bytes`);

        if (response.status !== 200) {
            console.log('❌ Failed to fetch page');
            return { success: false, error: `HTTP ${response.status}` };
        }

        // Extract title from page
        const titleMatch = response.data.match(/<title>([^<]+)<\/title>/);
        if (titleMatch) {
            console.log(`Page title: ${titleMatch[1]}`);
        }

        // Extract stream URL
        const result = extractStreamUrl(response.data);
        console.log(`\nExtraction method: ${result.method}`);

        if (result.url) {
            console.log(`✅ Stream URL found:`);
            console.log(`   ${result.url.substring(0, 100)}...`);
            return { success: true, url: result.url, method: result.method };
        } else if (result.urls) {
            console.log(`✅ Found ${result.urls.length} stream URL(s):`);
            result.urls.forEach((u, i) => {
                console.log(`   [${i + 1}] ${u.substring(0, 80)}...`);
            });
            return { success: true, urls: result.urls, method: result.method };
        } else {
            console.log('❌ No stream URL found');
            // Save HTML for debugging
            const fs = require('fs');
            const debugFile = `debug-prorcp-${media.tmdbId}.html`;
            fs.writeFileSync(debugFile, response.data);
            console.log(`   Saved HTML to ${debugFile} for debugging`);
            return { success: false, error: 'No stream URL found' };
        }
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// Main function
async function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     PRORCP DECODER TEST - Multiple Media Items             ║');
    console.log('║     Domain: ' + DOMAIN.padEnd(44) + '║');
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
