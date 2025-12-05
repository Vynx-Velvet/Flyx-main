const https = require('https');
const http = require('http');
const vm = require('vm');

const TEST_URL = 'https://cloudnestra.com/prorcp/NWViMzgzMjQ4ZGZjMGJmODA0NTkyZDQyYzQ5ZTRiNTA6VGtoVFdHaG9iRmMxWlVFdk1TOUtaMlpXVW1sT2NEaHZUbkkxY3pkelNEQnVXVWxxYkM5dldGWlhZakJVU2pKT2EybEtSRFJuYjJGbFRtdEdhRkpQTTNSQ2NqWTVRMmMzUTFOVU1sa3hRVWhEZWpoNE1YUlBNSEprUjFCVk5reENRako2TDJwVk1FSklkWFZYYkhjMlVGSnJObWRqYldveWFqVlBSelpYUm1STU4wRXlWemRLTDBFd2Qyd3hTbFJqWkVKclFuUjRiRzV1ZVhaSVRXWmhRVmxpWW5WTlNGcGlSV1UxYlU5aE1GazRkRU5SYlhodk4zUlBVR0prY2pkRk1EUTVZV05EYm0xa09ITTVSbXBhWVZobU1EQldVVkpaUmxwVEwzVnFZVFpNWmpSa1FUaEdVRWxFVGtGYVozTklTbTF1WlcxWVQzRkdkVFpPTjFCV1NubHNjbnB0T1V3dmQzSm1jUzkwZDFCbVJVeDBabG80ZUM5bE0wZ3libXROVUZwUVQwUm1OQ3MyZVUxS1owVkRhVk5rTTJZNFEwOWlkV2RtVVU0dlEzcHdTMHN5YVd4SE0xbE1UR05FYWxSamVYRjJWMlF4YzBWRU1uRnROa3M1TkZKTWQzcHZXSFp3TW5relZpOHhVWHAyYmtaYVpGbG5TMmhITWxkSGQxUnhkVTVaZWtOaFJtSkZhV0ZQZEZkd2JHNU5WMmhoVlZGS2FTc3ZkazQxVUVwcVptbGtWbTFJY0ZJdmFuUTBTa1JxUlRsalJHNUxkMnQxWlZZNWNuaGFSR3BVWkZWYVZTOHlORkpvUWt0TFpIWlVhV1ZGYVZKREsyczJOMVJaV0daYVdsYzFNWHBKVEVKb2FYQXhha1F5VGxoT1ZGZGxVVzh6UldsMFIyNVhMME5zVXpSVGJFeHRMMHQyZFVsek5ISnBSelJWYTFCTVoyYzJlbXhRYUZWMWNtb3ZSa3ByV0dFM2FGZFFSRmh4TDJaTU9HUTJjMXBTZVRaSE5VSXlXRTB6ZGxaaFJHdHpZVmRXVFd0NlpIcDFRU3RVV0RKeVdtUjVlRFZHVW5VNFVuZHRiVzR4TUZWdFMzTTJlVEZEU3pOMFZHOHJialZZWkdscWVtc3lNamw0VVZscVZXUXZlVlIxU0hoc00xQkhSRGQyV0ZkbmFsUnNZMnBwS3k5NE5HbENhbGhtT0dwcVEzZDVWWFY0TUVST1dUWlBkVlpLTkRGMGVtbEtSSEZzVlRKelRscDNLekZSU0c5Qlp6VlBWMHd2VTFobVRYTkxkMEYyVFVKQlIyMTZObUphYVZGS01GZE1SWGhsY214dGFFTlRjbTB4WTNoVE9YUllXV2hRVlV0V0x5OVhObTByVFhsaVVYSjBlR1V2V1hBeldXUjBObkZRZWtad2RUSnlaSFI1Tkc1NWNXOVpjbE52V1RjNVFXeEtTbkpOV200M2JEZG1aR3QwTnpGd09IQTRlakJsZDJab1QwdHBZbVZ1Y1RoM2JpOWpPV3hYWjBoMVJXSlJTVGRxUVROU1kzZEplbUpNTVZaVVVHeGpMMVk1Tmt0aVFVaHZNbW9yYWxnNVpGVnlUV1J2VVZRck0weEdlRVp2T0VGM2MxQmtZMFI2Y3pBeVdqSldkMEY1WWs0elJGUk5Wa3N4TUdwSVNHSTBOV0k1YmxWU1prZ3ZORFJKWkRBdmMwUnpOMmxqWlVaeFpsaFlUMWRVWkVGT1JVSkxPVWhoSzBaNE5tTldRVXBuUkd0R0szRjBZbEZFY0VabE5VdFJXV00yWkZGbFYzWjVRV3RhV1RNMFFVOVdSSEU0TlV0U1NubG1VRzgxWkRaSFlYbHJNVzU0UkhwYVowVkdXVkIyV20xWE5GaG9kMkV6TkZreWQwOUhabXgxUnpGNlFuQkZNVGhoVkhGQ2VVcGFUV0ZqY1VORFRVeG1aalE1WjJGTFNFeHZNRVJwVVhsYWRHVjFZMlpoU0RVeFlYRmpiMEZtVmpCc1lTdFlaR1JpWkhGWFowOVBhM1ZITlUxdk5rbHZTa3hOTUVaeWJuVmljVE5vT0NzeVZsZ3ljRTlTT1Zsd1J5c3ZjRFpoVFVOdVkwNW5WMUIwU2xWeFJIWlJSRUZPWlhKNFNtVnhiRTF0WlVaYVVFZGxSSGRJYmpGbFUxVkJVMXB0Y2psbWQxWkxTRUZsYWxkb2VuQjZhRVkxWkd3NFVtazFkMDg1WjNWTVVWWTRZVTExT0VkTVVqUkZaMGN3Y3l0RFlsaENjRE55YURrPQ--';
const DOMAIN = 'shadowlandschronicles.com';

function fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const reqOptions = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
                ...options.headers
            }
        };
        
        protocol.get(url, reqOptions, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetch(res.headers.location, options).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
        }).on('error', reject);
    });
}

async function extractUrls() {
    console.log('=== Fetching and decoding prorcp page ===\n');
    
    const response = await fetch(TEST_URL);
    const html = response.data;
    
    const divMatch = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
    if (!divMatch) throw new Error('Could not find encoded div');
    
    const divId = divMatch[1];
    const encodedContent = divMatch[2];
    console.log('Div ID:', divId);
    
    const scriptMatch = html.match(/sV05kUlNvOdOxvtC\/([a-f0-9]+)\.js/);
    if (!scriptMatch) throw new Error('Could not find decoder script');
    
    const scriptHash = scriptMatch[1];
    const scriptUrl = `https://cloudnestra.com/sV05kUlNvOdOxvtC/${scriptHash}.js?_=${Date.now()}`;
    
    const scriptResponse = await fetch(scriptUrl);
    const decoderScript = scriptResponse.data;
    console.log('Decoder script fetched, length:', decoderScript.length);
    
    // Execute in sandbox
    const mockDocument = {
        getElementById: (id) => id === divId ? { innerHTML: encodedContent } : null
    };
    
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
        document: mockDocument,
        console: { log: () => {}, error: () => {}, warn: () => {} },
        setTimeout: () => {}, setInterval: () => {},
        atob: (str) => Buffer.from(str, 'base64').toString('binary'),
        btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
        String, Array, Object, parseInt, parseFloat, isNaN, isFinite,
        encodeURIComponent, decodeURIComponent, Math, Date, RegExp, JSON,
        Error, TypeError, RangeError, Uint8Array, ArrayBuffer
    };
    
    vm.runInContext(decoderScript, vm.createContext(sandbox), { timeout: 5000 });
    
    if (!decodedContent) throw new Error('Failed to decode content');
    
    // Extract all URLs
    const urls = decodedContent.match(/https?:\/\/[^\s"']+/g) || [];
    console.log(`\nExtracted ${urls.length} URLs from decoded content\n`);
    
    return urls;
}

async function verifyUrl(url, index) {
    // Replace domain variable patterns like {v1}, {v2}, etc.
    const resolvedUrl = url.replace(/\{v\d+\}/g, DOMAIN);
    
    try {
        const response = await fetch(resolvedUrl, {
            headers: { 'Referer': 'https://cloudnestra.com/' }
        });
        
        const isM3u8 = resolvedUrl.includes('.m3u8');
        const isValid = response.status === 200 && 
            (isM3u8 ? (response.data.includes('#EXTM3U') || response.data.includes('#EXT-X')) : true);
        
        const status = isValid ? '✅' : '❌';
        const contentType = response.headers['content-type'] || 'unknown';
        const preview = response.data.substring(0, 100).replace(/\n/g, ' ');
        
        console.log(`${index + 1}. ${status} [${response.status}] ${resolvedUrl.substring(0, 80)}...`);
        if (isM3u8 && isValid) {
            console.log(`   Content: ${preview}...`);
        } else if (!isValid) {
            console.log(`   Error: Status ${response.status}, Type: ${contentType}`);
        }
        
        return { url: resolvedUrl, valid: isValid, status: response.status };
    } catch (error) {
        console.log(`${index + 1}. ❌ ${resolvedUrl.substring(0, 80)}...`);
        console.log(`   Error: ${error.message}`);
        return { url: resolvedUrl, valid: false, error: error.message };
    }
}

async function main() {
    try {
        const urls = await extractUrls();
        
        console.log('=== Verifying Stream URLs ===');
        console.log(`Domain: ${DOMAIN}\n`);
        
        const results = [];
        for (let i = 0; i < urls.length; i++) {
            const result = await verifyUrl(urls[i], i);
            results.push(result);
            // Small delay between requests
            await new Promise(r => setTimeout(r, 200));
        }
        
        console.log('\n=== Summary ===');
        const valid = results.filter(r => r.valid).length;
        const invalid = results.filter(r => !r.valid).length;
        console.log(`Valid: ${valid}/${results.length}`);
        console.log(`Invalid: ${invalid}/${results.length}`);
        
        if (valid > 0) {
            console.log('\n✅ Working stream URLs:');
            results.filter(r => r.valid).forEach(r => console.log(`   ${r.url}`));
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();
