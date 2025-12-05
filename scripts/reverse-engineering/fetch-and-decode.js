const https = require('https');
const http = require('http');
const vm = require('vm');

// Configuration
const TEST_URL = 'https://cloudnestra.com/prorcp/NWViMzgzMjQ4ZGZjMGJmODA0NTkyZDQyYzQ5ZTRiNTA6VGtoVFdHaG9iRmMxWlVFdk1TOUtaMlpXVW1sT2NEaHZUbkkxY3pkelNEQnVXVWxxYkM5dldGWlhZakJVU2pKT2EybEtSRFJuYjJGbFRtdEdhRkpQTTNSQ2NqWTVRMmMzUTFOVU1sa3hRVWhEZWpoNE1YUlBNSEprUjFCVk5reENRako2TDJwVk1FSklkWFZYYkhjMlVGSnJObWRqYldveWFqVlBSelpYUm1STU4wRXlWemRLTDBFd2Qyd3hTbFJqWkVKclFuUjRiRzV1ZVhaSVRXWmhRVmxpWW5WTlNGcGlSV1UxYlU5aE1GazRkRU5SYlhodk4zUlBVR0prY2pkRk1EUTVZV05EYm0xa09ITTVSbXBhWVZobU1EQldVVkpaUmxwVEwzVnFZVFpNWmpSa1FUaEdVRWxFVGtGYVozTklTbTF1WlcxWVQzRkdkVFpPTjFCV1NubHNjbnB0T1V3dmQzSm1jUzkwZDFCbVJVeDBabG80ZUM5bE0wZ3libXROVUZwUVQwUm1OQ3MyZVUxS1owVkRhVk5rTTJZNFEwOWlkV2RtVVU0dlEzcHdTMHN5YVd4SE0xbE1UR05FYWxSamVYRjJWMlF4YzBWRU1uRnROa3M1TkZKTWQzcHZXSFp3TW5relZpOHhVWHAyYmtaYVpGbG5TMmhITWxkSGQxUnhkVTVaZWtOaFJtSkZhV0ZQZEZkd2JHNU5WMmhoVlZGS2FTc3ZkazQxVUVwcVptbGtWbTFJY0ZJdmFuUTBTa1JxUlRsalJHNUxkMnQxWlZZNWNuaGFSR3BVWkZWYVZTOHlORkpvUWt0TFpIWlVhV1ZGYVZKREsyczJOMVJaV0daYVdsYzFNWHBKVEVKb2FYQXhha1F5VGxoT1ZGZGxVVzh6UldsMFIyNVhMME5zVXpSVGJFeHRMMHQyZFVsek5ISnBSelJWYTFCTVoyYzJlbXhRYUZWMWNtb3ZSa3ByV0dFM2FGZFFSRmh4TDJaTU9HUTJjMXBTZVRaSE5VSXlXRTB6ZGxaaFJHdHpZVmRXVFd0NlpIcDFRU3RVV0RKeVdtUjVlRFZHVW5VNFVuZHRiVzR4TUZWdFMzTTJlVEZEU3pOMFZHOHJialZZWkdscWVtc3lNamw0VVZscVZXUXZlVlIxU0hoc00xQkhSRGQyV0ZkbmFsUnNZMnBwS3k5NE5HbENhbGhtT0dwcVEzZDVWWFY0TUVST1dUWlBkVlpLTkRGMGVtbEtSSEZzVlRKelRscDNLekZSU0c5Qlp6VlBWMHd2VTFobVRYTkxkMEYyVFVKQlIyMTZObUphYVZGS01GZE1SWGhsY214dGFFTlRjbTB4WTNoVE9YUllXV2hRVlV0V0x5OVhObTByVFhsaVVYSjBlR1V2V1hBeldXUjBObkZRZWtad2RUSnlaSFI1Tkc1NWNXOVpjbE52V1RjNVFXeEtTbkpOV200M2JEZG1aR3QwTnpGd09IQTRlakJsZDJab1QwdHBZbVZ1Y1RoM2JpOWpPV3hYWjBoMVJXSlJTVGRxUVROU1kzZEplbUpNTVZaVVVHeGpMMVk1Tmt0aVFVaHZNbW9yYWxnNVpGVnlUV1J2VVZRck0weEdlRVp2T0VGM2MxQmtZMFI2Y3pBeVdqSldkMEY1WWs0elJGUk5Wa3N4TUdwSVNHSTBOV0k1YmxWU1prZ3ZORFJKWkRBdmMwUnpOMmxqWlVaeFpsaFlUMWRVWkVGT1JVSkxPVWhoSzBaNE5tTldRVXBuUkd0R0szRjBZbEZFY0VabE5VdFJXV00yWkZGbFYzWjVRV3RhV1RNMFFVOVdSSEU0TlV0U1NubG1VRzgxWkRaSFlYbHJNVzU0UkhwYVowVkdXVkIyV20xWE5GaG9kMkV6TkZreWQwOUhabXgxUnpGNlFuQkZNVGhoVkhGQ2VVcGFUV0ZqY1VORFRVeG1aalE1WjJGTFNFeHZNRVJwVVhsYWRHVjFZMlpoU0RVeFlYRmpiMEZtVmpCc1lTdFlaR1JpWkhGWFowOVBhM1ZITlUxdk5rbHZTa3hOTUVaeWJuVmljVE5vT0NzeVZsZ3ljRTlTT1Zsd1J5c3ZjRFpoVFVOdVkwNW5WMUIwU2xWeFJIWlJSRUZPWlhKNFNtVnhiRTF0WlVaYVVFZGxSSGRJYmpGbFUxVkJVMXB0Y2psbWQxWkxTRUZsYWxkb2VuQjZhRVkxWkd3NFVtazFkMDg1WjNWTVVWWTRZVTExT0VkTVVqUkZaMGN3Y3l0RFlsaENjRE55YURrPQ--';

function fetch(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Referer': 'https://vidsrc.xyz/'
            }
        };
        
        protocol.get(url, options, (res) => {
            // Handle redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetch(res.headers.location).then(resolve).catch(reject);
            }
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
        }).on('error', reject);
    });
}

async function extractFromProrcp(url) {
    console.log('Fetching prorcp page:', url);
    
    const response = await fetch(url);
    if (response.status !== 200) {
        throw new Error(`Failed to fetch page: ${response.status}`);
    }
    
    const html = response.data;
    
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
    const scriptUrl = `https://cloudnestra.com/sV05kUlNvOdOxvtC/${scriptHash}.js?_=1744906950`;
    console.log('\nFetching decoder script:', scriptUrl);
    
    const scriptResponse = await fetch(scriptUrl);
    if (scriptResponse.status !== 200) {
        throw new Error(`Failed to fetch decoder script: ${scriptResponse.status}`);
    }
    
    const decoderScript = scriptResponse.data;
    console.log('Decoder script length:', decoderScript.length);
    
    // Try to extract the decoder function and key from the script
    return extractKeyFromScript(decoderScript, divId, encodedContent);
}

function extractKeyFromScript(script, divId, encodedContent) {
    console.log('\n=== Analyzing decoder script ===\n');
    
    // The script ends with something like:
    // window[bMGyx71TzQLfdonN("reversedDivId")] = decoderFunc(document.getElementById(bMGyx71TzQLfdonN("reversedDivId")).innerHTML);
    
    // Find the window assignment at the end
    const windowAssignMatch = script.match(/window\[([^\]]+)\]\s*=\s*([A-Za-z0-9_]+)\(document\.getElementById/);
    
    if (windowAssignMatch) {
        console.log('Found window assignment pattern');
        const decoderFuncName = windowAssignMatch[2];
        console.log('Decoder function name:', decoderFuncName);
    }
    
    // Look for the string reversal function (bMGyx71TzQLfdonN or similar)
    // It typically does: str.split('').reverse().join('')
    const reverseFuncMatch = script.match(/function\s+([A-Za-z0-9_]+)\s*\([^)]*\)\s*\{[^}]*split\(['"]['"]['"]\)[^}]*reverse\(\)[^}]*join/);
    
    // Try to find string literals that might be the key
    const stringLiterals = script.match(/'[^']{10,50}'/g) || [];
    console.log(`Found ${stringLiterals.length} string literals (10-50 chars)`);
    
    // Look for the reversed div ID in the script
    const reversedDivId = divId.split('').reverse().join('');
    console.log('Looking for reversed div ID:', reversedDivId);
    
    if (script.includes(reversedDivId)) {
        console.log('✅ Found reversed div ID in script!');
    }
    
    // Try to find hex-like patterns that could be the key
    const hexPatterns = script.match(/[0-9a-f]{32,}/gi) || [];
    console.log(`Found ${hexPatterns.length} hex patterns (32+ chars)`);
    
    // The key might be embedded as an array of numbers
    const arrayPatterns = script.match(/\[(\d+,\s*){10,}\d+\]/g) || [];
    console.log(`Found ${arrayPatterns.length} number arrays`);
    
    // Try to execute the script in a sandboxed environment
    console.log('\n=== Attempting sandboxed execution ===\n');
    
    return executeSandboxed(script, divId, encodedContent);
}

function executeSandboxed(script, divId, encodedContent) {
    // Create a mock DOM environment
    const mockDocument = {
        getElementById: (id) => {
            if (id === divId) {
                return { innerHTML: encodedContent };
            }
            return null;
        }
    };
    
    const capturedValues = [];
    let blobContent = null;
    
    const mockWindow = new Proxy({}, {
        set: (target, prop, value) => {
            capturedValues.push({ prop, value });
            target[prop] = value;
            return true;
        },
        get: (target, prop) => target[prop]
    });
    
    const sandbox = {
        window: mockWindow,
        document: mockDocument,
        console: { log: () => {}, error: () => {}, warn: () => {} },
        setTimeout: () => {},
        setInterval: () => {},
        URL: {
            createObjectURL: (blob) => {
                if (blob && blob.parts && blob.parts[0]) {
                    blobContent = blob.parts[0];
                }
                return 'blob:mock';
            }
        },
        Blob: function(parts, options) {
            this.parts = parts;
            this.options = options;
        },
        atob: (str) => Buffer.from(str, 'base64').toString('binary'),
        btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
        String, Array, Object, parseInt, parseFloat, isNaN, isFinite,
        encodeURIComponent, decodeURIComponent, Math, Date, RegExp, JSON,
        Error, TypeError, RangeError, Uint8Array, ArrayBuffer
    };
    
    try {
        const context = vm.createContext(sandbox);
        console.log('Executing decoder script...');
        vm.runInContext(script, context, { timeout: 5000 });
        
        console.log('Captured', capturedValues.length, 'window assignments');
        
        // Check blob content first
        if (blobContent) {
            console.log('\n✅ Blob content captured!');
            console.log('Length:', blobContent.length);
            console.log('Preview:', blobContent.substring(0, 300));
            
            const urls = blobContent.match(/https?:\/\/[^\s"]+/g);
            if (urls) {
                console.log(`\nFound ${urls.length} URLs:`);
                urls.slice(0, 5).forEach((url, i) => console.log(`${i+1}. ${url.substring(0, 120)}`));
            }
            return blobContent;
        }
        
        // Check window assignments
        for (const { prop, value } of capturedValues) {
            if (typeof value === 'string' && value.length > 0 && 
                (value.includes('https://') || value.startsWith('{') || value.startsWith('['))) {
                console.log(`\n✅ window["${prop}"] contains decoded content!`);
                console.log('Length:', value.length);
                console.log('Preview:', value.substring(0, 300));
                
                const urls = value.match(/https?:\/\/[^\s"]+/g);
                if (urls) {
                    console.log(`\nFound ${urls.length} URLs:`);
                    urls.slice(0, 5).forEach((url, i) => console.log(`${i+1}. ${url.substring(0, 120)}`));
                }
                return value;
            }
        }
        
        return null;
    } catch (error) {
        console.error('Sandbox execution failed:', error.message);
        return tryManualDecode(script, divId, encodedContent);
    }
}

function tryManualDecode(script, divId, encodedContent) {
    console.log('\n=== Trying manual decode ===\n');
    
    // The obfuscated script typically has a pattern like:
    // 1. A string array with encoded strings
    // 2. A decoder function that uses charCodeAt and fromCharCode
    // 3. XOR operations
    
    // Look for the main decoder function pattern
    // It usually involves: charCodeAt, fromCharCode, and XOR (^)
    
    const hasCharCodeAt = script.includes('charCodeAt');
    const hasFromCharCode = script.includes('fromCharCode');
    const hasXOR = script.includes('^');
    
    console.log('Has charCodeAt:', hasCharCodeAt);
    console.log('Has fromCharCode:', hasFromCharCode);
    console.log('Has XOR:', hasXOR);
    
    // Try to find embedded key by looking at the script structure
    // The key is often derived from the div ID or embedded as a constant
    
    // Check if encoded content is hex
    const isHex = /^[0-9a-f]+$/i.test(encodedContent);
    console.log('Encoded content is hex:', isHex);
    
    if (isHex) {
        // Convert hex to bytes
        const bytes = [];
        for (let i = 0; i < encodedContent.length; i += 2) {
            bytes.push(parseInt(encodedContent.substr(i, 2), 16));
        }
        console.log('Converted to', bytes.length, 'bytes');
        
        // Try common key derivations
        const keysToTry = [
            divId,
            divId.split('').reverse().join(''),
            divId + divId,
        ];
        
        for (const key of keysToTry) {
            let decoded = '';
            for (let i = 0; i < bytes.length; i++) {
                decoded += String.fromCharCode(bytes[i] ^ key.charCodeAt(i % key.length));
            }
            
            if (decoded.includes('https://') && decoded.includes('.m3u8')) {
                console.log(`\n✅ Found working key: "${key}"`);
                console.log('Decoded:', decoded.substring(0, 500));
                return decoded;
            }
        }
    }
    
    return null;
}

// Main execution
async function main() {
    try {
        const result = await extractFromProrcp(TEST_URL);
        console.log('\n=== Final Result ===');
        if (result) {
            console.log('Successfully extracted content');
        } else {
            console.log('Could not extract content');
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();
