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
console.log('Div ID:', divId);
console.log('Total bytes:', fullBytes.length);

// From previous analysis, position 10 looks promising
// Let's assume the data starts at position 10 and try to find the key

// We know the structure should be JSON like: {"file":"https://...
// Let's try different known plaintext patterns

const knownPatterns = [
    '{"file":"https://tmstr1.cloudnestra.com/',
    '{"file":"https://tmstr2.cloudnestra.com/',
    '{"file":"https://tmstr3.cloudnestra.com/',
    '{"file":"https://tmstr4.cloudnestra.com/',
    '{"file":"https://tmstr5.cloudnestra.com/',
    '[{"file":"https://tmstr',
    '{"file":"https://putgate',
];

console.log('\n=== Trying known plaintext patterns ===\n');

for (const pattern of knownPatterns) {
    // Try at different starting positions
    for (let startPos = 0; startPos <= 20; startPos++) {
        if (startPos + pattern.length > fullBytes.length) continue;
        
        // Derive key from this pattern at this position
        const derivedKey = [];
        for (let i = 0; i < pattern.length; i++) {
            derivedKey.push(fullBytes[startPos + i] ^ pattern.charCodeAt(i));
        }
        
        // Check if key looks reasonable (mostly printable)
        const printableCount = derivedKey.filter(b => b >= 32 && b < 127).length;
        const printableRatio = printableCount / derivedKey.length;
        
        if (printableRatio < 0.8) continue;
        
        // Try decoding with this key
        let decoded = '';
        for (let i = startPos; i < Math.min(startPos + 500, fullBytes.length); i++) {
            const keyIndex = (i - startPos) % derivedKey.length;
            decoded += String.fromCharCode(fullBytes[i] ^ derivedKey[keyIndex]);
        }
        
        // Check if decoded looks valid
        const urlCount = (decoded.match(/https:\/\//g) || []).length;
        const hasM3u8 = decoded.includes('.m3u8') || decoded.includes('/pl/');
        const hasValidJson = decoded.startsWith('{"file"') || decoded.startsWith('[{"file"');
        
        if (hasValidJson && (urlCount > 0 || hasM3u8)) {
            console.log(`✅ Pattern: "${pattern.substring(0, 30)}..." at position ${startPos}`);
            console.log(`   Key (first 50): ${derivedKey.slice(0, 50).map(b => String.fromCharCode(b)).join('')}`);
            console.log(`   Key bytes: ${derivedKey.slice(0, 30).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
            console.log(`   URLs found: ${urlCount}, has m3u8: ${hasM3u8}`);
            console.log(`   Decoded (first 300): ${decoded.substring(0, 300)}`);
            console.log('');
            
            // Try to find if key repeats
            for (let keyLen = 10; keyLen <= derivedKey.length; keyLen++) {
                const testKey = derivedKey.slice(0, keyLen);
                let fullDecoded = '';
                for (let i = startPos; i < fullBytes.length; i++) {
                    fullDecoded += String.fromCharCode(fullBytes[i] ^ testKey[(i - startPos) % keyLen]);
                }
                
                const fullUrlCount = (fullDecoded.match(/https:\/\//g) || []).length;
                const fullHasM3u8 = fullDecoded.includes('.m3u8');
                
                if (fullUrlCount > 5 && fullHasM3u8) {
                    console.log(`   ✅✅ Key length ${keyLen} works! URLs: ${fullUrlCount}`);
                    console.log(`   Full decoded (first 500): ${fullDecoded.substring(0, 500)}`);
                    
                    // Extract all URLs
                    const urls = fullDecoded.match(/https?:\/\/[^\s"]+/g);
                    if (urls) {
                        console.log(`\n   Found ${urls.length} URLs:`);
                        urls.slice(0, 10).forEach((url, i) => {
                            console.log(`   ${i+1}. ${url.substring(0, 100)}`);
                        });
                    }
                    break;
                }
            }
        }
    }
}
