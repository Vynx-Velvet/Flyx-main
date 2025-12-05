const fs = require('fs');

const file = 'debug-prorcp-1396.html';
const html = fs.readFileSync(file, 'utf8');
const match = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);

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

// We know the URL should start with "https://tmstr5." or similar
// Let's try to find the key length by looking for repeating patterns

// The expected start is: https://tmstr5.{v1}/pl/H4sI
const expectedStart = 'https://tmstr5.{v1}/pl/H4sIAAAAAAAAA';
console.log('Expected start length:', expectedStart.length);

// Derive key from expected start
const derivedKey = [];
for (let i = 0; i < expectedStart.length && i < fullBytes.length; i++) {
    derivedKey.push(fullBytes[i] ^ expectedStart.charCodeAt(i));
}

console.log('\nDerived key from expected URL start:');
console.log('Key bytes:', derivedKey.slice(0, 40).map(b => b.toString(16).padStart(2, '0')).join(' '));
console.log('Key as string:', derivedKey.slice(0, 40).map(b => String.fromCharCode(b)).join(''));

// Check if key repeats
function findKeyLength(key) {
    for (let len = 1; len <= key.length / 2; len++) {
        let matches = true;
        for (let i = len; i < key.length; i++) {
            if (key[i] !== key[i % len]) {
                matches = false;
                break;
            }
        }
        if (matches) return len;
    }
    return key.length;
}

const keyLen = findKeyLength(derivedKey);
console.log('\nDetected key length:', keyLen);

// Try decoding with the derived key
const keyToUse = derivedKey.slice(0, Math.min(keyLen, 64));
console.log('Using key length:', keyToUse.length);

let decoded = '';
for (let i = 0; i < fullBytes.length; i++) {
    decoded += String.fromCharCode(fullBytes[i] ^ keyToUse[i % keyToUse.length]);
}

console.log('\nDecoded result:');
console.log('First 200:', decoded.substring(0, 200));

if (decoded.includes('https://') && decoded.includes('.m3u8')) {
    console.log('\n✅ SUCCESS!');
    const urls = decoded.match(/https?:\/\/[^\s]+/g);
    if (urls) {
        console.log('Found', urls.length, 'URLs');
        urls.slice(0, 3).forEach((u, i) => console.log(`${i+1}. ${u.substring(0, 100)}`));
    }
} else {
    console.log('\n❌ Decoding failed');
    
    // Let's look at the key pattern more carefully
    console.log('\nAnalyzing key pattern...');
    
    // Check if key might be related to div ID or other page elements
    const divId = match[1];
    console.log('Div ID:', divId);
    console.log('Div ID bytes:', divId.split('').map(c => c.charCodeAt(0).toString(16)).join(' '));
    
    // Check first 64 key bytes for patterns
    console.log('\nFirst 64 key bytes:');
    for (let i = 0; i < 64 && i < derivedKey.length; i += 16) {
        const chunk = derivedKey.slice(i, i + 16);
        console.log(`${i.toString().padStart(2)}: ${chunk.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
    }
}
