const https = require('https');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DOMAIN = 'shadowlandschronicles.com';

function fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : require('http');
        const urlObj = new URL(url);
        const reqOptions = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
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

async function main() {
    console.log('=== Testing with saved prorcp HTML ===\n');
    
    // Read saved HTML file
    const htmlPath = path.join(__dirname, '../../debug-prorcp-550.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    console.log('Loaded saved HTML, length:', html.length);
    
    // Extract div ID and encoded content
    const divMatch = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
    if (!divMatch) {
        throw new Error('Could not find encoded div');
    }
    
    const divId = divMatch[1];
    const encodedContent = divMatch[2];
    console.log('Div ID:', divId);
    console.log('Encoded length:', encodedContent.length);
    
    // Extract script hash
    const scriptMatch = html.match(/sV05kUlNvOdOxvtC\/([a-f0-9]+)\.js/);
    if (!scriptMatch) {
        throw new Error('Could not find decoder script reference');
    }
    
    const scriptHash = scriptMatch[1];
    console.log('Script hash:', scriptHash);
    
    // Fetch the decoder script
    const scriptUrl = `https://cloudnestra.com/sV05kUlNvOdOxvtC/${scriptHash}.js?_=${Date.now()}`;
    console.log('\nFetching decoder script:', scriptUrl);
    
    const scriptResponse = await fetch(scriptUrl);
    if (scriptResponse.status !== 200) {
        throw new Error(`Failed to fetch decoder script: ${scriptResponse.status}`);
    }
    
    const decoderScript = scriptResponse.data;
    console.log('Decoder script length:', decoderScript.length);
    
    // Execute in sandbox
    console.log('\n=== Executing decoder in sandbox ===\n');
    
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
        
        if (!decodedContent) {
            throw new Error('No decoded content captured');
        }
        
        console.log('✅ Decoded successfully!');
        console.log('Preview:', decodedContent.substring(0, 300));
        
        // Extract m3u8 URLs
        const urls = decodedContent.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/g) || [];
        console.log(`\nFound ${urls.length} m3u8 URLs`);
        
        // Replace domain variables and deduplicate
        const resolvedUrls = [...new Set(urls.map(url => url.replace(/\{v\d+\}/g, DOMAIN)))];
        console.log(`Unique URLs after domain replacement: ${resolvedUrls.length}`);
        
        // Verify URLs
        console.log('\n=== Verifying stream URLs ===\n');
        
        for (let i = 0; i < Math.min(resolvedUrls.length, 5); i++) {
            const url = resolvedUrls[i];
            console.log(`[${i + 1}] ${url.substring(0, 80)}...`);
            
            try {
                const response = await fetch(url, {
                    headers: { 'Referer': 'https://cloudnestra.com/' }
                });
                
                const isValid = response.status === 200 && 
                    (response.data.includes('#EXTM3U') || response.data.includes('#EXT-X'));
                
                if (isValid) {
                    console.log(`    ✅ Valid HLS playlist (${response.data.length} bytes)`);
                    console.log(`    Preview: ${response.data.substring(0, 80).replace(/\n/g, ' ')}`);
                } else {
                    console.log(`    ❌ Invalid: Status ${response.status}, Content: ${response.data.substring(0, 50)}`);
                }
            } catch (error) {
                console.log(`    ❌ Error: ${error.message}`);
            }
            
            await new Promise(r => setTimeout(r, 300));
        }
        
        console.log('\n=== Summary ===');
        console.log('Total URLs found:', resolvedUrls.length);
        if (resolvedUrls.length > 0) {
            console.log('\nFirst working URL:');
            console.log(resolvedUrls[0]);
        }
        
    } catch (error) {
        console.error('Decode error:', error.message);
    }
}

main().catch(console.error);
