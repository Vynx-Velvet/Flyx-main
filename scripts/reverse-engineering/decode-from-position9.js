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

// We found {"file":" at position 9
// Let's derive the key from this known plaintext
const knownPlaintext = '{"file":"https://';
const startPos = 9;

// Derive key from known plaintext
const derivedKey = [];
for (let i = 0; i < knownPlaintext.length; i++) {
    derivedKey.push(fullBytes[startPos + i] ^ knownPlaintext.charCodeAt(i));
}

console.log('\nDerived key from position 9:');
console.log('Key bytes:', derivedKey.map(b => b.toString(16).padStart(2, '0')).join(' '));
console.log('Key string:', derivedKey.map(b => String.fromCharCode(b)).join(''));
console.log('Key length:', derivedKey.length);

// Check if key repeats
function findRepeatingPattern(arr) {
    for (let len = 1; len <= arr.length / 2; len++) {
        let matches = true;
        for (let i = len; i < arr.length; i++) {
            if (arr[i] !== arr[i % len]) {
                matches = false;
                break;
            }
        }
        if (matches) return len;
    }
    return arr.length;
}

const repeatLen = findRepeatingPattern(derivedKey);
console.log('Repeating pattern length:', repeatLen);

// Try decoding with the derived key (assuming it repeats)
console.log('\n=== Decoding with derived key ===\n');

// The key might need to be aligned differently
// If data starts at position 9, the key at position 0 would be offset by 9
for (let keyOffset = 0; keyOffset < derivedKey.length; keyOffset++) {
    let decoded = '';
    for (let i = 0; i < fullBytes.length; i++) {
        const keyIndex = (i + keyOffset) % derivedKey.length;
        decoded += String.fromCharCode(fullBytes[i] ^ derivedKey[keyIndex]);
    }
    
    // Check if this produces valid JSON
    const jsonStart = decoded.indexOf('{"file"');
    const httpsCount = (decoded.match(/https:\/\//g) || []).length;
    
    if (jsonStart >= 0 && jsonStart < 20) {
        console.log(`Key offset ${keyOffset}:`);
        console.log(`  JSON starts at: ${jsonStart}`);
        console.log(`  HTTPS count: ${httpsCount}`);
        console.log(`  First 300 chars: ${decoded.substring(0, 300)}`);
        console.log('');
        
        // Try to extract URLs
        const urls = decoded.match(/https?:\/\/[^\s"]+/g);
        if (urls && urls.length > 0) {
            console.log(`  Found ${urls.length} URLs:`);
            urls.slice(0, 5).forEach((url, i) => {
                console.log(`    ${i+1}. ${url.substring(0, 100)}`);
            });
        }
        console.log('');
    }
}

// The first 9 bytes might be a header
console.log('\n=== Analyzing first 9 bytes (header) ===\n');
const header = fullBytes.slice(0, 9);
console.log('Header bytes:', header.map(b => b.toString(16).padStart(2, '0')).join(' '));
console.log('Header as decimal:', header.join(', '));

// What if the header contains key info?
// First byte might be key length or offset
console.log('\nFirst byte as potential key length:', header[0]);
console.log('First 2 bytes as potential key length:', (header[0] << 8) | header[1]);

// Try: header might be XORed with something to get the key
console.log('\n=== Trying header-based key derivation ===\n');

// XOR header with divId
const headerXorDivId = [];
for (let i = 0; i < header.length; i++) {
    headerXorDivId.push(header[i] ^ divId.charCodeAt(i % divId.length));
}
console.log('Header XOR divId:', headerXorDivId.map(b => b.toString(16).padStart(2, '0')).join(' '));
console.log('As string:', headerXorDivId.map(b => String.fromCharCode(b)).join(''));
