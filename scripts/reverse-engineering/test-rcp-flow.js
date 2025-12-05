const https = require('https');
const vm = require('vm');

const TMDB_ID = '550';
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
            res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers, cookies: res.headers['set-cookie'] }));
        }).on('error', reject);
    });
}

async function main() {
    console.log('=== Testing RCP Flow ===\n');
    
    // Step 1: Get vidsrc-embed page
    console.log('Step 1: Fetching vidsrc-embed.ru...');
    const embedUrl = `https://vidsrc-embed.ru/embed/movie/${TMDB_ID}`;
    const embedResponse = await fetch(embedUrl);
    console.log('Status:', embedResponse.status);
    
    // Extract the iframe src
    const iframeMatch = embedResponse.data.match(/<iframe[^>]*src=["']([^"']+cloudnestra\.com\/rcp\/([^"']+))["']/i);
    if (!iframeMatch) {
        console.log('No iframe found');
        return;
    }
    
    const rcpPath = iframeMatch[2];
    console.log('RCP hash:', rcpPath.substring(0, 50) + '...');
    
    // Step 2: Try the /rcp/ endpoint
    console.log('\nStep 2: Trying /rcp/ endpoint...');
    const rcpUrl = `https://cloudnestra.com/rcp/${rcpPath}`;
    const rcpResponse = await fetch(rcpUrl, {
        headers: { 'Referer': 'https://vidsrc-embed.ru/' }
    });
    console.log('Status:', rcpResponse.status);
    console.log('Response length:', rcpResponse.data.length);
    
    // Check if it's a Cloudflare challenge
    if (rcpResponse.data.includes('cf-turnstile')) {
        console.log('Cloudflare Turnstile challenge detected');
        
        // Look for the callback URL pattern
        const callbackMatch = rcpResponse.data.match(/data-callback="([^"]+)"/);
        if (callbackMatch) {
            console.log('Callback function:', callbackMatch[1]);
        }
        
        // Check for the verify endpoint
        const verifyMatch = rcpResponse.data.match(/\$\.post\("([^"]+)"/);
        if (verifyMatch) {
            console.log('Verify endpoint:', verifyMatch[1]);
        }
        
        // Show the full page to understand the flow
        console.log('\n=== RCP Page Content ===');
        console.log(rcpResponse.data.substring(0, 3000));
    } else {
        // Check if we got the actual content
        const divMatch = rcpResponse.data.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
        if (divMatch) {
            console.log('✅ Got encoded content directly from /rcp/!');
            console.log('Div ID:', divMatch[1]);
            console.log('Encoded length:', divMatch[2].length);
        } else {
            console.log('Page preview:', rcpResponse.data.substring(0, 1000));
        }
    }
    
    // Check for turnstile in the response
    if (rcpResponse.data.includes('turnstile')) {
        console.log('\n=== Turnstile detected ===');
        // Extract the verify endpoint
        const verifyMatch = rcpResponse.data.match(/\$\.post\("([^"]+)",\s*\{token:\s*token\}/);
        if (verifyMatch) {
            console.log('Verify endpoint:', verifyMatch[1]);
        }
        
        // Show the script that handles verification
        const scriptMatch = rcpResponse.data.match(/function cftCallback\(token\)\{([^}]+)\}/);
        if (scriptMatch) {
            console.log('Callback logic:', scriptMatch[1]);
        }
        
        // Show full page for analysis
        console.log('\n=== Full RCP Page ===');
        console.log(rcpResponse.data);
    }
    
    // Step 3: Try /prorcp/ endpoint directly
    console.log('\nStep 3: Trying /prorcp/ endpoint...');
    const prorcpUrl = `https://cloudnestra.com/prorcp/${rcpPath}`;
    const prorcpResponse = await fetch(prorcpUrl, {
        headers: { 'Referer': 'https://vidsrc-embed.ru/' }
    });
    console.log('Status:', prorcpResponse.status);
    
    if (prorcpResponse.status === 200) {
        // Check for encoded div
        const divMatch = prorcpResponse.data.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
        if (divMatch) {
            console.log('✅ Found encoded div!');
            console.log('Div ID:', divMatch[1]);
            console.log('Encoded length:', divMatch[2].length);
            
            // Extract script hash
            const scriptMatch = prorcpResponse.data.match(/sV05kUlNvOdOxvtC\/([a-f0-9]+)\.js/);
            if (scriptMatch) {
                console.log('Script hash:', scriptMatch[1]);
                
                // Fetch and execute decoder
                console.log('\nStep 4: Fetching decoder script...');
                const scriptUrl = `https://cloudnestra.com/sV05kUlNvOdOxvtC/${scriptMatch[1]}.js?_=${Date.now()}`;
                const scriptResponse = await fetch(scriptUrl);
                console.log('Decoder script length:', scriptResponse.data.length);
                
                // Execute decoder
                console.log('\nStep 5: Executing decoder...');
                const divId = divMatch[1];
                const encodedContent = divMatch[2];
                
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
                
                if (decodedContent) {
                    console.log('✅ Decoded successfully!');
                    
                    // Extract and verify URLs
                    const urls = decodedContent.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/g) || [];
                    const resolvedUrls = [...new Set(urls.map(url => url.replace(/\{v\d+\}/g, DOMAIN)))];
                    
                    console.log(`\nFound ${resolvedUrls.length} unique m3u8 URLs`);
                    
                    // Test first URL
                    if (resolvedUrls.length > 0) {
                        console.log('\nStep 6: Verifying first stream URL...');
                        const testUrl = resolvedUrls[0];
                        console.log('URL:', testUrl.substring(0, 80) + '...');
                        
                        const streamResponse = await fetch(testUrl, {
                            headers: { 'Referer': 'https://cloudnestra.com/' }
                        });
                        
                        if (streamResponse.status === 200 && streamResponse.data.includes('#EXTM3U')) {
                            console.log('✅ Stream URL is VALID!');
                            console.log('Playlist preview:', streamResponse.data.substring(0, 100).replace(/\n/g, ' '));
                        } else {
                            console.log('❌ Stream URL invalid:', streamResponse.status);
                        }
                    }
                } else {
                    console.log('❌ Decoding failed');
                }
            }
        } else {
            console.log('No encoded div found');
            console.log('Page preview:', prorcpResponse.data.substring(0, 500));
        }
    } else {
        console.log('prorcp returned:', prorcpResponse.status);
        console.log('Preview:', prorcpResponse.data.substring(0, 300));
    }
}

main().catch(console.error);
