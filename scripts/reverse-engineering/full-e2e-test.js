const https = require('https');
const vm = require('vm');

// Test configuration - can be movie or TV show
const TEST_TYPE = process.argv[2] || 'movie'; // 'movie' or 'tv'
const TMDB_ID = process.argv[3] || '550'; // Fight Club for movie, 1396 for Breaking Bad
const SEASON = process.argv[4] || '1';
const EPISODE = process.argv[5] || '1';
const DOMAIN = 'shadowlandschronicles.com';

function fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        https.get({
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                ...options.headers
            }
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const newUrl = res.headers.location.startsWith('http') 
                    ? res.headers.location 
                    : `${urlObj.protocol}//${urlObj.host}${res.headers.location}`;
                return fetch(newUrl, options).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        }).on('error', reject);
    });
}

async function main() {
    console.log('========================================');
    console.log('Full E2E Stream Extraction Test');
    console.log(`Type: ${TEST_TYPE}`);
    console.log(`TMDB ID: ${TMDB_ID}`);
    if (TEST_TYPE === 'tv') {
        console.log(`Season: ${SEASON}, Episode: ${EPISODE}`);
    }
    console.log(`Domain: ${DOMAIN}`);
    console.log('========================================\n');
    
    // Step 1: Get vidsrc-embed page
    console.log('Step 1: Fetching vidsrc-embed.ru...');
    const embedUrl = TEST_TYPE === 'tv' 
        ? `https://vidsrc-embed.ru/embed/tv/${TMDB_ID}/${SEASON}/${EPISODE}`
        : `https://vidsrc-embed.ru/embed/movie/${TMDB_ID}`;
    const embedResponse = await fetch(embedUrl);
    console.log('Status:', embedResponse.status);
    
    // Extract the iframe src (rcp URL)
    const iframeMatch = embedResponse.data.match(/<iframe[^>]*src=["']([^"']+cloudnestra\.com\/rcp\/([^"']+))["']/i);
    if (!iframeMatch) {
        throw new Error('No iframe found in vidsrc-embed page');
    }
    
    const rcpPath = iframeMatch[2];
    console.log('RCP hash found');
    
    // Step 2: Fetch RCP page to get the prorcp URL
    console.log('\nStep 2: Fetching /rcp/ page...');
    const rcpUrl = `https://cloudnestra.com/rcp/${rcpPath}`;
    const rcpResponse = await fetch(rcpUrl, {
        headers: { 'Referer': 'https://vidsrc-embed.ru/' }
    });
    console.log('Status:', rcpResponse.status);
    
    // Extract the prorcp URL from the loadIframe function
    const prorcpMatch = rcpResponse.data.match(/src:\s*['"]\/prorcp\/([^'"]+)['"]/);
    if (!prorcpMatch) {
        throw new Error('Could not find prorcp URL in rcp page');
    }
    
    const prorcpPath = prorcpMatch[1];
    console.log('PRORCP hash found');
    
    // Step 3: Fetch PRORCP page
    console.log('\nStep 3: Fetching /prorcp/ page...');
    const prorcpUrl = `https://cloudnestra.com/prorcp/${prorcpPath}`;
    const prorcpResponse = await fetch(prorcpUrl, {
        headers: { 'Referer': 'https://cloudnestra.com/' }
    });
    console.log('Status:', prorcpResponse.status);
    
    if (prorcpResponse.status !== 200) {
        throw new Error(`PRORCP returned ${prorcpResponse.status}`);
    }
    
    // Extract div ID and encoded content
    const divMatch = prorcpResponse.data.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
    if (!divMatch) {
        console.log('Page preview:', prorcpResponse.data.substring(0, 500));
        throw new Error('Could not find encoded div in prorcp page');
    }
    
    const divId = divMatch[1];
    const encodedContent = divMatch[2];
    console.log('Div ID:', divId);
    console.log('Encoded length:', encodedContent.length);
    
    // Extract script hash
    const scriptMatch = prorcpResponse.data.match(/sV05kUlNvOdOxvtC\/([a-f0-9]+)\.js/);
    if (!scriptMatch) {
        throw new Error('Could not find decoder script reference');
    }
    
    const scriptHash = scriptMatch[1];
    console.log('Script hash:', scriptHash);
    
    // Step 4: Fetch decoder script
    console.log('\nStep 4: Fetching decoder script...');
    const scriptUrl = `https://cloudnestra.com/sV05kUlNvOdOxvtC/${scriptHash}.js?_=${Date.now()}`;
    const scriptResponse = await fetch(scriptUrl);
    console.log('Decoder script length:', scriptResponse.data.length);
    
    // Step 5: Execute decoder in sandbox
    console.log('\nStep 5: Executing decoder...');
    
    let decodedContent = null;
    const mockWindow = new Proxy({}, {
        set: (target, prop, value) => {
            if (typeof value === 'string' && value.includes('https://')) {
                decodedContent = value;
            }
            target[prop] = value;
            return true;
        },
        get: (target, prop) => target[prop]
    });
    
    const sandbox = {
        window: mockWindow,
        document: { getElementById: (id) => id === divId ? { innerHTML: encodedContent } : null },
        console: { log: () => {}, error: () => {}, warn: () => {} },
        setTimeout: () => {}, setInterval: () => {},
        atob: (str) => Buffer.from(str, 'base64').toString('binary'),
        btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
        String, Array, Object, parseInt, parseFloat, isNaN, isFinite,
        encodeURIComponent, decodeURIComponent, Math, Date, RegExp, JSON,
        Error, TypeError, RangeError, Uint8Array, ArrayBuffer
    };
    
    vm.runInContext(scriptResponse.data, vm.createContext(sandbox), { timeout: 5000 });
    
    if (!decodedContent) {
        throw new Error('Decoding failed - no content captured');
    }
    
    console.log('✅ Decoded successfully!');
    console.log('Preview:', decodedContent.substring(0, 200));
    
    // Step 6: Extract and verify URLs
    console.log('\nStep 6: Extracting stream URLs...');
    const urls = decodedContent.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/g) || [];
    const resolvedUrls = [...new Set(urls.map(url => url.replace(/\{v\d+\}/g, DOMAIN)))];
    console.log(`Found ${resolvedUrls.length} unique m3u8 URLs`);
    
    // Step 7: Verify URLs
    console.log('\nStep 7: Verifying stream URLs...');
    
    let workingUrls = [];
    for (let i = 0; i < Math.min(resolvedUrls.length, 5); i++) {
        const url = resolvedUrls[i];
        console.log(`\n[${i + 1}] ${url.substring(0, 70)}...`);
        
        try {
            const response = await fetch(url, {
                headers: { 'Referer': 'https://cloudnestra.com/' }
            });
            
            const isValid = response.status === 200 && 
                (response.data.includes('#EXTM3U') || response.data.includes('#EXT-X'));
            
            if (isValid) {
                console.log(`    ✅ Valid HLS playlist (${response.data.length} bytes)`);
                workingUrls.push(url);
            } else {
                console.log(`    ❌ Invalid: Status ${response.status}`);
            }
        } catch (error) {
            console.log(`    ❌ Error: ${error.message}`);
        }
        
        await new Promise(r => setTimeout(r, 200));
    }
    
    // Summary
    console.log('\n========================================');
    console.log('RESULTS');
    console.log('========================================');
    console.log(`Working streams: ${workingUrls.length}/${resolvedUrls.length}`);
    
    if (workingUrls.length > 0) {
        console.log('\n✅ SUCCESS! Working stream URL:');
        console.log(workingUrls[0]);
    } else {
        console.log('\n❌ No working streams found');
    }
}

main().catch(err => {
    console.error('\n❌ FAILED:', err.message);
});
