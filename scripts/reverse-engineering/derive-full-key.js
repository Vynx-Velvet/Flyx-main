const fs = require('fs');

const file = 'debug-prorcp-1396.html';
const html = fs.readFileSync(file, 'utf8');
const match = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);

const divId = match[1];
const encoded = match[2];

function hexToBytes(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
}

const fullBytes = hexToBytes(encoded);
console.log('Total bytes:', fullBytes.length);
console.log('Div ID:', divId);

// Header analysis
const headerByte = fullBytes[0]; // 0x14 = 20
console.log('\nFirst byte (potential key length):', headerByte);

// Try key length of 20
const keyLength = 20;
console.log('Trying key length:', keyLength);

// We know the structure should be something like:
// [header bytes][{"file":"https://...
// Let's assume the JSON starts right after a fixed header

// Try different header lengths
for (let headerLen = 0; headerLen <= 20; headerLen++) {
    // Assume JSON starts at headerLen
    const knownPlaintext = '{"file":"https://tmstr';
    
    if (headerLen + knownPlaintext.length > fullBytes.length) continue;
    
    // Derive key from known plaintext
    const derivedKey = [];
    for (let i = 0; i < knownPlaintext.length; i++) {
        derivedKey.push(fullBytes[headerLen + i] ^ knownPlaintext.charCodeAt(i));
    }
    
    // Check if key looks reasonable (mostly printable or has pattern)
    const keyStr = derivedKey.map(b => String.fromCharCode(b)).join('');
    
    // Try decoding with this key
    let decoded = '';
    for (let i = headerLen; i < Math.min(headerLen + 500, fullBytes.length); i++) {
        const keyIndex = (i - headerLen) % derivedKey.length;
        decoded += String.fromCharCode(fullBytes[i] ^ derivedKey[keyIndex]);
    }
    
    // Check if decoded looks like valid JSON with URLs
    if (decoded.startsWith('{"file":"https://') && decoded.includes('.m3u8')) {
        console.log(`\n✅ SUCCESS! Header length: ${headerLen}`);
        console.log('Key:', keyStr);
        console.log('Key bytes:', derivedKey.map(b => b.toString(16).padStart(2, '0')).join(' '));
        console.log('\nDecoded (first 500 chars):');
        console.log(decoded);
        
        // Try to decode the full content
        let fullDecoded = '';
        for (let i = headerLen; i < fullBytes.length; i++) {
            const keyIndex = (i - headerLen) % derivedKey.length;
            fullDecoded += String.fromCharCode(fullBytes[i] ^ derivedKey[keyIndex]);
        }
        
        // Extract URLs
        const urls = fullDecoded.match(/https?:\/\/[^\s"]+/g);
        if (urls) {
            console.log(`\nFound ${urls.length} URLs:`);
            urls.slice(0, 10).forEach((url, i) => {
                console.log(`${i+1}. ${url.substring(0, 120)}`);
            });
        }
        
        // Try to parse as JSON
        try {
            // Find the end of JSON
            let jsonEnd = fullDecoded.lastIndexOf('}');
            if (jsonEnd > 0) {
                const jsonStr = fullDecoded.substring(0, jsonEnd + 1);
                const parsed = JSON.parse(jsonStr);
                console.log('\n✅ Valid JSON!');
                console.log('Parsed:', JSON.stringify(parsed, null, 2).substring(0, 500));
            }
        } catch (e) {
            console.log('\nJSON parse error:', e.message);
        }
        
        break;
    }
}

// Also try with cloudnestra domain
console.log('\n=== Trying with cloudnestra domain ===\n');

for (let headerLen = 0; headerLen <= 20; headerLen++) {
    const knownPlaintext = '{"file":"https://tmstr1.cloudnestra.com/';
    
    if (headerLen + knownPlaintext.length > fullBytes.length) continue;
    
    const derivedKey = [];
    for (let i = 0; i < knownPlaintext.length; i++) {
        derivedKey.push(fullBytes[headerLen + i] ^ knownPlaintext.charCodeAt(i));
    }
    
    let decoded = '';
    for (let i = headerLen; i < Math.min(headerLen + 500, fullBytes.length); i++) {
        const keyIndex = (i - headerLen) % derivedKey.length;
        decoded += String.fromCharCode(fullBytes[i] ^ derivedKey[keyIndex]);
    }
    
    if (decoded.startsWith('{"file":"https://tmstr') && decoded.includes('/pl/')) {
        console.log(`✅ Found with header length ${headerLen}!`);
        console.log('Decoded:', decoded.substring(0, 300));
        
        // Full decode
        let fullDecoded = '';
        for (let i = headerLen; i < fullBytes.length; i++) {
            const keyIndex = (i - headerLen) % derivedKey.length;
            fullDecoded += String.fromCharCode(fullBytes[i] ^ derivedKey[keyIndex]);
        }
        
        const urls = fullDecoded.match(/https?:\/\/[^\s"]+/g);
        if (urls) {
            console.log(`\nFound ${urls.length} URLs:`);
            urls.slice(0, 5).forEach((url, i) => {
                console.log(`${i+1}. ${url}`);
            });
        }
        break;
    }
}
