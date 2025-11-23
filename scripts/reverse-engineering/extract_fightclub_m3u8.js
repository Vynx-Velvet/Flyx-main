const https = require('https');
const http = require('http');

// Our custom decoder from analysis
var abc = "ABCDEFGHIJKLMabcdefghijklmNOPQRSTUVWXYZnopqrstuvwxyz";

var salt = {
    _keyStr: abc + "0123456789+/=",
    d: function (e) {
        var t = "";
        var n, r, i, s, o, u, a;
        var f = 0;
        e = e.replace(/[^A-Za-z0-9\+\/\=]/g, "");
        while (f < e.length) {
            s = this._keyStr.indexOf(e.charAt(f++));
            o = this._keyStr.indexOf(e.charAt(f++));
            u = this._keyStr.indexOf(e.charAt(f++));
            a = this._keyStr.indexOf(e.charAt(f++));
            n = s << 2 | o >> 4;
            r = (o & 15) << 4 | u >> 2;
            i = (u & 3) << 6 | a;
            t = t + String.fromCharCode(n);
            if (u != 64) {
                t = t + String.fromCharCode(r)
            }
            if (a != 64) {
                t = t + String.fromCharCode(i)
            }
        }
        t = salt._ud(t);
        return t
    },
    _ud: function (e) {
        var t = "";
        var n = 0;
        var r = 0;
        var c1 = 0;
        var c2 = 0;
        var c3 = 0;
        while (n < e.length) {
            r = e.charCodeAt(n);
            if (r < 128) {
                t += String.fromCharCode(r);
                n++
            } else if (r > 191 && r < 224) {
                c2 = e.charCodeAt(n + 1);
                t += String.fromCharCode((r & 31) << 6 | c2 & 63);
                n += 2
            } else {
                c2 = e.charCodeAt(n + 1);
                c3 = e.charCodeAt(n + 2);
                t += String.fromCharCode((r & 15) << 12 | (c2 & 63) << 6 | c3 & 63);
                n += 3
            }
        }
        return t
    }
};

function decode(x) {
    if (typeof x == "object") {
        x = JSON.stringify(x);
    }
    if (x.substr(0, 2) == "#1") {
        let s = x.substr(2);
        s = s.replace(/#/g, "+");
        return salt.d(s);
    } else if (x.substr(0, 2) == "#0") {
        return salt.d(x.substr(2));
    } else {
        return x;
    }
}

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;

        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://vidsrc-embed.ru/',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        };

        client.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ data, headers: res.headers }));
        }).on('error', reject);
    });
}

async function extractFromSuperembed() {
    console.log('='.repeat(80));
    console.log('SUPEREMBED M3U8 EXTRACTION - FIGHT CLUB');
    console.log('Using Custom PlayerJS Decoder');
    console.log('='.repeat(80));
    console.log();

    // Fight Club TMDB ID: 550
    const tmdbId = '550';

    try {
        // Step 1: Get VidSrc embed page
        console.log('[STEP 1] Fetching VidSrc embed page...');
        const vidsrcUrl = `https://vidsrc-embed.ru/embed/movie/${tmdbId}`;
        console.log(`URL: ${vidsrcUrl}`);

        const vidsrcResponse = await fetchUrl(vidsrcUrl);
        console.log(`✓ Response received (${vidsrcResponse.data.length} bytes)`);

        // Save the page for inspection
        const fs = require('fs');
        fs.writeFileSync('vidsrc_embed_page.html', vidsrcResponse.data);
        console.log('✓ Saved page to: vidsrc_embed_page.html');

        // Extract data-hash
        const dataHashMatch = vidsrcResponse.data.match(/data-hash=["']([^"']+)["']/);
        if (!dataHashMatch) {
            console.log('✗ Could not find data-hash');
            console.log('\nSearching for iframes...');
            const iframeMatches = vidsrcResponse.data.match(/iframe[^>]*src=["']([^"']+)["']/gi);
            if (iframeMatches) {
                console.log(`Found ${iframeMatches.length} iframe(s):`);
                iframeMatches.forEach((m, i) => {
                    const src = m.match(/src=["']([^"']+)["']/);
                    if (src) console.log(`  ${i + 1}. ${src[1]}`);
                });
            }
            return;
        }

        const dataHash = dataHashMatch[1];
        console.log(`✓ Found data-hash: ${dataHash}`);
        console.log();

        // Step 2: Get RCP URL
        console.log('[STEP 2] Fetching RCP URL...');
        const rcpApiUrl = `https://vidsrc-embed.ru/api/source/${dataHash}`;
        console.log(`URL: ${rcpApiUrl}`);

        const rcpResponse = await fetchUrl(rcpApiUrl);
        console.log(`✓ Response received (${rcpResponse.data.length} bytes)`);

        let rcpData;
        try {
            rcpData = JSON.parse(rcpResponse.data);
            console.log('✓ Parsed JSON response');
            console.log(`  Keys: ${Object.keys(rcpData).join(', ')}`);
            if (rcpData.url) console.log(`  URL: ${rcpData.url.substring(0, 80)}...`);
        } catch (e) {
            console.log(`✗ Failed to parse JSON: ${e.message}`);
            console.log('Raw response:', rcpResponse.data.substring(0, 200));
            return;
        }

        if (!rcpData.url) {
            console.log('✗ No URL in response');
            return;
        }
        console.log();

        // Step 3: Get ProRCP page
        console.log('[STEP 3] Fetching ProRCP player page...');
        const prorcp = rcpData.url.startsWith('//') ? 'https:' + rcpData.url : rcpData.url;
        console.log(`URL: ${prorcp.substring(0, 80)}...`);

        const prorpcResponse = await fetchUrl(prorcp);
        console.log(`✓ Response received (${prorpcResponse.data.length} bytes)`);

        fs.writeFileSync('prorcp_fightclub.html', prorpcResponse.data);
        console.log('✓ Saved ProRCP page to: prorcp_fightclub.html');
        console.log();

        // Step 4: Search for encoded data
        console.log('[STEP 4] Searching for encoded PlayerJS data...');

        // Look for patterns like #1... or #0... in quotes
        const encodedPatterns = [
            /['"]#1([A-Za-z0-9+\/=#]+)['"]/,
            /['"]#0([A-Za-z0-9+\/=#]+)['"]/,
            /decode\(['"]#1([^'"]+)['"]\)/,
            /decode\(['"]#0([^'"]+)['"]\)/
        ];

        const foundEncoded = [];

        for (const pattern of encodedPatterns) {
            const matches = [...prorpcResponse.data.matchAll(new RegExp(pattern, 'g'))];
            matches.forEach(match => {
                const prefix = match[0].includes('#1') ? '#1' : '#0';
                const encoded = prefix + match[1];
                if (encoded.length > 10) {  // Filter out very short matches
                    foundEncoded.push({
                        type: prefix,
                        encoded: encoded,
                        position: match.index
                    });
                }
            });
        }

        console.log(`✓ Found ${foundEncoded.length} encoded string(s)`);
        console.log();

        if (foundEncoded.length === 0) {
            console.log('✗ No encoded data found in standard patterns');
            console.log('\nTrying alternate search...');

            // Try finding any #1 or #0 patterns
            const altMatch1 = prorpcResponse.data.match(/#1[A-Za-z0-9+\/=#]{100,}/);
            const altMatch0 = prorpcResponse.data.match(/#0[A-Za-z0-9+\/=#]{100,}/);

            if (altMatch1 || altMatch0) {
                console.log('Found potential encoded strings!');
                if (altMatch1) foundEncoded.push({ type: '#1', encoded: altMatch1[0], position: 0 });
                if (altMatch0) foundEncoded.push({ type: '#0', encoded: altMatch0[0], position: 0 });
            } else {
                console.log('✗ No encoded data found');
                return;
            }
        }

        // Step 5: Decode and search for M3U8/master.txt
        console.log('[STEP 5] Decoding and searching for M3U8/master.txt URLs...');
        console.log();

        const m3u8Urls = [];
        const masterTxtUrls = [];

        foundEncoded.forEach((item, idx) => {
            console.log(`[Encoded String ${idx + 1}]`);
            console.log(`Type: ${item.type}`);
            console.log(`Position: ${item.position}`);
            console.log(`Length: ${item.encoded.length} characters`);

            try {
                const decoded = decode(item.encoded);
                console.log(`✓ Decoded successfully (${decoded.length} characters)`);

                // Search for M3U8 URLs
                const m3u8Matches = decoded.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/gi);
                if (m3u8Matches) {
                    console.log(`  Found ${m3u8Matches.length} M3U8 URL(s):`);
                    m3u8Matches.forEach(url => {
                        console.log(`    - ${url}`);
                        if (!m3u8Urls.includes(url)) m3u8Urls.push(url);
                    });
                }

                // Search for master.txt URLs
                const masterMatches = decoded.match(/https?:\/\/[^\s"']+master\.txt[^\s"']*/gi);
                if (masterMatches) {
                    console.log(`  Found ${masterMatches.length} master.txt URL(s):`);
                    masterMatches.forEach(url => {
                        console.log(`    - ${url}`);
                        if (!masterTxtUrls.includes(url)) masterTxtUrls.push(url);
                    });
                }

                // Search for any video URLs
                const videoMatches = decoded.match(/https?:\/\/[^\s"']+\.(mp4|mkv|avi|webm)[^\s"']*/gi);
                if (videoMatches) {
                    console.log(`  Found ${videoMatches.length} video URL(s):`);
                    videoMatches.forEach(url => {
                        console.log(`    - ${url.substring(0, 80)}...`);
                    });
                }

                // Save decoded content
                fs.writeFileSync(`decoded_fightclub_${idx + 1}.txt`, decoded);
                console.log(`  ✓ Saved to: decoded_fightclub_${idx + 1}.txt`);

            } catch (e) {
                console.log(`  ✗ Decode failed: ${e.message}`);
            }

            console.log();
        });

        // Summary
        console.log('='.repeat(80));
        console.log('EXTRACTION SUMMARY');
        console.log('='.repeat(80));
        console.log();
        console.log(`Total M3U8 URLs found: ${m3u8Urls.length}`);
        if (m3u8Urls.length > 0) {
            console.log('\nM3U8 URLs:');
            m3u8Urls.forEach((url, i) => {
                console.log(`${i + 1}. ${url}`);
            });
        }

        console.log();
        console.log(`Total master.txt URLs found: ${masterTxtUrls.length}`);
        if (masterTxtUrls.length > 0) {
            console.log('\nmaster.txt URLs:');
            masterTxtUrls.forEach((url, i) => {
                console.log(`${i + 1}. ${url}`);
            });
        }

        // Save results
        const results = {
            movie: 'Fight Club',
            tmdbId: tmdbId,
            timestamp: new Date().toISOString(),
            encodedStringsFound: foundEncoded.length,
            m3u8Urls: m3u8Urls,
            masterTxtUrls: masterTxtUrls
        };

        fs.writeFileSync('fightclub_extraction_results.json', JSON.stringify(results, null, 2));
        console.log('\n✓ Results saved to: fightclub_extraction_results.json');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('\n✗ ERROR:', error.message);
        console.error(error.stack);
    }
}

// Run extraction
extractFromSuperembed();
