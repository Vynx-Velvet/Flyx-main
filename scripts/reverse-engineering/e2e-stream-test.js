const https = require('https');
const http = require('http');
const vm = require('vm');

// Test with a known movie - Fight Club (TMDB ID: 550)
const TMDB_ID = '550';
const DOMAIN = 'shadowlandschronicles.com';

function fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const urlObj = new URL(url);
        const reqOptions = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                ...options.headers
            }
        };
        
        protocol.get(reqOptions, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const newUrl = res.headers.location.startsWith('http') 
                    ? res.headers.location 
                    : `${urlObj.protocol}//${urlObj.host}${res.headers.location}`;
                return fetch(newUrl, options).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
        }).on('error', reject);
    });
}

async function step1_getVidsrcEmbed() {
    console.log('=== STEP 1: Fetch vidsrc-embed.ru ===');
    const url = `https://vidsrc-embed.ru/embed/movie/${TMDB_ID}`;
    console.log('URL:', url);
    
    const response = await fetch(url);
    console.log('Status:', response.status);
    
    // Extract the iframe src which contains the hash
    const iframeMatch = response.data.match(/<iframe[^>]*src=["']([^"']+cloudnestra\.com\/rcp\/([^"']+))["']/i);
    if (iframeMatch) {
        const hash = iframeMatch[2];
        // Convert /rcp/ to /prorcp/ to bypass Cloudflare verification
        const prorcpUrl = `https://cloudnestra.com/prorcp/${hash}`;
        console.log('Found hash:', hash.substring(0, 50) + '...');
        console.log('Converted to PRORCP URL');
        return prorcpUrl;
    }
    
    // Fallback: try data-hash from server list (CloudStream Pro)
    const dataHashMatch = response.data.match(/data-hash="([^"]+)"/);
    if (dataHashMatch) {
        const hash = dataHashMatch[1];
        const prorcpUrl = `https://cloudnestra.com/prorcp/${hash}`;
        console.log('Found data-hash:', hash.substring(0, 50) + '...');
        return prorcpUrl;
    }
    
    console.log('Page preview:', response.data.substring(0, 1000));
    throw new Error('Could not find RCP URL in vidsrc-embed page');
}

async function step2_getProrcpPage(rcpUrl) {
    console.log('\n=== STEP 2: Fetch prorcp page ===');
    
    // Ensure URL is absolute
    if (!rcpUrl.startsWith('http')) {
        rcpUrl = 'https:' + rcpUrl;
    }
    
    // The /rcp/ endpoint requires Cloudflare verification
    // Try /prorcp/ directly which doesn't need verification
    if (rcpUrl.includes('/rcp/') && !rcpUrl.includes('/prorcp/')) {
        rcpUrl = rcpUrl.replace('/rcp/', '/prorcp/');
    }
    
    console.log('URL:', rcpUrl);
    
    const response = await fetch(rcpUrl, {
        headers: { 'Referer': 'https://vidsrc-embed.ru/' }
    });
    console.log('Status:', response.status);
    
    if (response.status === 404) {
        // Token might be expired or invalid, show what we got
        console.log('Page preview:', response.data.substring(0, 500));
        throw new Error('prorcp page returned 404 - token may be expired');
    }
    
    // Extract div ID and encoded content
    const divMatch = response.data.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
    if (!divMatch) {
        // Check if it's a Cloudflare challenge page
        if (response.data.includes('cf-turnstile') || response.data.includes('cloudflare')) {
            console.log('Cloudflare protection detected');
            throw new Error('Cloudflare protection - need browser automation');
        }
        console.log('Page preview:', response.data.substring(0, 2000));
        throw new Error('Could not find encoded div');
    }
    
    const divId = divMatch[1];
    const encodedContent = divMatch[2];
    console.log('Div ID:', divId);
    console.log('Encoded length:', encodedContent.length);
    
    // Extract script hash
    const scriptMatch = response.data.match(/sV05kUlNvOdOxvtC\/([a-f0-9]+)\.js/);
    if (!scriptMatch) {
        throw new Error('Could not find decoder script reference');
    }
    
    const scriptHash = scriptMatch[1];
    console.log('Script hash:', scriptHash);
    
    // Get base URL for script
    const urlObj = new URL(rcpUrl);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
    
    return { divId, encodedContent, scriptHash, baseUrl };
}

async function step3_fetchDecoder(baseUrl, scriptHash) {
    console.log('\n=== STEP 3: Fetch decoder script ===');
    const scriptUrl = `${baseUrl}/sV05kUlNvOdOxvtC/${scriptHash}.js?_=${Date.now()}`;
    console.log('URL:', scriptUrl);
    
    const response = await fetch(scriptUrl, {
        headers: { 'Referer': baseUrl }
    });
    console.log('Status:', response.status);
    console.log('Script length:', response.data.length);
    
    return response.data;
}

function step4_decode(decoderScript, divId, encodedContent) {
    console.log('\n=== STEP 4: Execute decoder in sandbox ===');
    
    const mockDocument = {
        getElementById: (id) => {
            console.log('getElementById called:', id);
            if (id === divId) {
                return { innerHTML: encodedContent };
            }
            return null;
        }
    };
    
    let decodedContent = null;
    const mockWindow = new Proxy({}, {
        set: (target, prop, value) => {
            if (typeof value === 'string' && value.length > 100) {
                console.log(`window["${prop}"] set, length: ${value.length}`);
                if (value.includes('https://') || value.includes('http://')) {
                    decodedContent = value;
                }
            }
            target[prop] = value;
            return true;
        },
        get: (target, prop) => target[prop]
    });
    
    const sandbox = {
        window: mockWindow,
        document: mockDocument,
        console: { log: () => {}, error: () => {}, warn: () => {} },
        setTimeout: () => {}, setInterval: () => {},
        atob: (str) => Buffer.from(str, 'base64').toString('binary'),
        btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
        String, Array, Object, parseInt, parseFloat, isNaN, isFinite,
        encodeURIComponent, decodeURIComponent, Math, Date, RegExp, JSON,
        Error, TypeError, RangeError, Uint8Array, ArrayBuffer
    };
    
    try {
        vm.runInContext(decoderScript, vm.createContext(sandbox), { timeout: 5000 });
        
        if (decodedContent) {
            console.log('✅ Decoded successfully!');
            console.log('Preview:', decodedContent.substring(0, 200));
            return decodedContent;
        }
        throw new Error('No decoded content captured');
    } catch (error) {
        console.error('Decode error:', error.message);
        throw error;
    }
}

function step5_extractUrls(decodedContent) {
    console.log('\n=== STEP 5: Extract stream URLs ===');
    
    const urls = decodedContent.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/g) || [];
    console.log(`Found ${urls.length} m3u8 URLs`);
    
    // Replace domain variables
    const resolvedUrls = urls.map(url => url.replace(/\{v\d+\}/g, DOMAIN));
    
    // Deduplicate
    const uniqueUrls = [...new Set(resolvedUrls)];
    console.log(`Unique URLs: ${uniqueUrls.length}`);
    
    return uniqueUrls;
}

async function step6_verifyUrls(urls) {
    console.log('\n=== STEP 6: Verify stream URLs ===');
    
    const results = [];
    for (let i = 0; i < Math.min(urls.length, 5); i++) {
        const url = urls[i];
        console.log(`\n[${i + 1}] Testing: ${url.substring(0, 80)}...`);
        
        try {
            const response = await fetch(url, {
                headers: { 'Referer': 'https://cloudnestra.com/' }
            });
            
            const isValid = response.status === 200 && 
                (response.data.includes('#EXTM3U') || response.data.includes('#EXT-X'));
            
            if (isValid) {
                console.log(`    ✅ Valid HLS playlist (${response.data.length} bytes)`);
                console.log(`    Preview: ${response.data.substring(0, 100).replace(/\n/g, ' ')}`);
                results.push({ url, valid: true });
            } else {
                console.log(`    ❌ Invalid: Status ${response.status}`);
                results.push({ url, valid: false, status: response.status });
            }
        } catch (error) {
            console.log(`    ❌ Error: ${error.message}`);
            results.push({ url, valid: false, error: error.message });
        }
        
        await new Promise(r => setTimeout(r, 300));
    }
    
    return results;
}

async function main() {
    console.log('========================================');
    console.log('E2E Stream Extraction Test');
    console.log(`TMDB ID: ${TMDB_ID} (Fight Club)`);
    console.log(`Domain: ${DOMAIN}`);
    console.log('========================================\n');
    
    try {
        const rcpUrl = await step1_getVidsrcEmbed();
        const { divId, encodedContent, scriptHash, baseUrl } = await step2_getProrcpPage(rcpUrl);
        const decoderScript = await step3_fetchDecoder(baseUrl, scriptHash);
        const decodedContent = step4_decode(decoderScript, divId, encodedContent);
        const urls = step5_extractUrls(decodedContent);
        const results = await step6_verifyUrls(urls);
        
        console.log('\n========================================');
        console.log('FINAL RESULTS');
        console.log('========================================');
        const validCount = results.filter(r => r.valid).length;
        console.log(`Valid streams: ${validCount}/${results.length}`);
        
        if (validCount > 0) {
            console.log('\n✅ SUCCESS! Working stream URL:');
            console.log(results.find(r => r.valid).url);
        } else {
            console.log('\n❌ No valid streams found');
        }
    } catch (error) {
        console.error('\n❌ FAILED:', error.message);
    }
}

main();
