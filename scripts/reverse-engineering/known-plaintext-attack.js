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

// Known plaintext patterns that might appear in the decoded output
const knownPatterns = [
    { text: 'https://tmstr', offset: 0 },
    { text: 'https://putgate', offset: 0 },
    { text: '{"file":"', offset: 0 },
    { text: '[{"file":"', offset: 0 },
    { text: 'https://', offset: 0 },
];

// For each pattern, try to find where it might be in the encoded data
console.log('\n=== Searching for known plaintext patterns ===\n');

for (const pattern of knownPatterns) {
    const patternBytes = pattern.text.split('').map(c => c.charCodeAt(0));
    
    // Try each position in the encoded data
    for (let pos = 0; pos < Math.min(100, fullBytes.length - patternBytes.length); pos++) {
        // Derive key at this position
        const derivedKey = [];
        for (let i = 0; i < patternBytes.length; i++) {
            derivedKey.push(fullBytes[pos + i] ^ patternBytes[i]);
        }
        
        // Check if this key looks like it could be part of divId or other known string
        const keyStr = derivedKey.map(b => String.fromCharCode(b)).join('');
        
        // Check if key is printable ASCII
        const isPrintable = derivedKey.every(b => b >= 32 && b < 127);
        
        // Check if key matches divId pattern
        const matchesDivId = keyStr.includes(divId.substring(0, 3)) || 
                            divId.includes(keyStr.substring(0, 3));
        
        if (isPrintable || matchesDivId) {
            console.log(`Pattern "${pattern.text}" at position ${pos}:`);
            console.log(`  Key bytes: ${derivedKey.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
            console.log(`  Key string: "${keyStr}"`);
            
            // Try using this key to decode more data
            let decoded = '';
            for (let i = 0; i < Math.min(100, fullBytes.length); i++) {
                const keyByte = derivedKey[i % derivedKey.length];
                decoded += String.fromCharCode(fullBytes[i] ^ keyByte);
            }
            
            if (decoded.includes('https://') || decoded.includes('file')) {
                console.log(`  ✅ Decoded contains URL!`);
                console.log(`  Decoded: ${decoded.substring(0, 150)}`);
            }
            console.log('');
        }
    }
}

// Try a different approach: the key might be the divId XORed with something
console.log('\n=== Trying divId-based key transformations ===\n');

// The divId is 10 chars, try using it as a repeating key with various transformations
const transformations = [
    { name: 'divId as-is', key: divId },
    { name: 'divId reversed', key: divId.split('').reverse().join('') },
    { name: 'divId + divId', key: divId + divId },
    { name: 'divId lowercase', key: divId.toLowerCase() },
    { name: 'divId uppercase', key: divId.toUpperCase() },
];

for (const transform of transformations) {
    const key = transform.key;
    
    // Try with different starting offsets in the key
    for (let keyOffset = 0; keyOffset < key.length; keyOffset++) {
        let decoded = '';
        for (let i = 0; i < Math.min(100, fullBytes.length); i++) {
            const keyChar = key.charCodeAt((i + keyOffset) % key.length);
            decoded += String.fromCharCode(fullBytes[i] ^ keyChar);
        }
        
        if (decoded.includes('https://') || decoded.includes('{"file"')) {
            console.log(`✅ ${transform.name} with offset ${keyOffset}:`);
            console.log(`   Decoded: ${decoded.substring(0, 150)}`);
        }
    }
}

// Try XOR with position-based key derivation
console.log('\n=== Trying position-based key derivation ===\n');

// Key might be: divId[i % divId.length] XOR (i & 0xFF)
for (let xorMask = 0; xorMask < 256; xorMask++) {
    let decoded = '';
    for (let i = 0; i < Math.min(100, fullBytes.length); i++) {
        const keyChar = divId.charCodeAt(i % divId.length) ^ (i & xorMask);
        decoded += String.fromCharCode(fullBytes[i] ^ keyChar);
    }
    
    if (decoded.includes('https://')) {
        console.log(`✅ Found with XOR mask ${xorMask} (0x${xorMask.toString(16)}):`);
        console.log(`   Decoded: ${decoded.substring(0, 150)}`);
    }
}

// Try: key[i] = divId[i % len] XOR (i / len)
console.log('\n=== Trying block-based key derivation ===\n');

for (let blockXor = 0; blockXor < 256; blockXor++) {
    let decoded = '';
    for (let i = 0; i < Math.min(100, fullBytes.length); i++) {
        const block = Math.floor(i / divId.length);
        const keyChar = divId.charCodeAt(i % divId.length) ^ (block & blockXor);
        decoded += String.fromCharCode(fullBytes[i] ^ keyChar);
    }
    
    if (decoded.includes('https://')) {
        console.log(`✅ Found with block XOR ${blockXor}:`);
        console.log(`   Decoded: ${decoded.substring(0, 150)}`);
    }
}
