const fs = require('fs');

// The target is to decode hex to get "https://"
// https:// in hex is: 68 74 74 70 73 3a 2f 2f
// The encoded starts with: c5 f4 63 20 f6 f4 b0 c5

// If XOR: c5 ^ key[0] = 68 (h) => key[0] = c5 ^ 68 = ad
//         f4 ^ key[1] = 74 (t) => key[1] = f4 ^ 74 = 80
//         63 ^ key[2] = 74 (t) => key[2] = 63 ^ 74 = 17
//         20 ^ key[3] = 70 (p) => key[3] = 20 ^ 70 = 50
//         f6 ^ key[4] = 73 (s) => key[4] = f6 ^ 73 = 85
//         f4 ^ key[5] = 3a (:) => key[5] = f4 ^ 3a = ce
//         b0 ^ key[6] = 2f (/) => key[6] = b0 ^ 2f = 9f
//         c5 ^ key[7] = 2f (/) => key[7] = c5 ^ 2f = ea

const file = 'debug-prorcp-1396.html';
const html = fs.readFileSync(file, 'utf8');
const match = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);

const divId = match[1];
const encoded = match[2];

console.log('Div ID:', divId);
console.log('Encoded first 16 hex chars:', encoded.substring(0, 16));

// Convert hex string to bytes
function hexToBytes(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
}

// Target: "https://"
const target = [0x68, 0x74, 0x74, 0x70, 0x73, 0x3a, 0x2f, 0x2f];
const encodedBytes = hexToBytes(encoded.substring(0, 16));

console.log('\nEncoded bytes:', encodedBytes.map(b => b.toString(16).padStart(2, '0')).join(' '));
console.log('Target bytes:  ', target.map(b => b.toString(16).padStart(2, '0')).join(' '));

// Calculate XOR key
const key = [];
for (let i = 0; i < 8; i++) {
    key.push(encodedBytes[i] ^ target[i]);
}
console.log('Derived key:   ', key.map(b => b.toString(16).padStart(2, '0')).join(' '));
console.log('Key as string: ', key.map(b => String.fromCharCode(b)).join(''));

// Now try to decode the full string with this key
const fullBytes = hexToBytes(encoded);
let decoded = '';
for (let i = 0; i < fullBytes.length; i++) {
    decoded += String.fromCharCode(fullBytes[i] ^ key[i % key.length]);
}

console.log('\n--- Decoded with derived key ---');
console.log('First 200 chars:', decoded.substring(0, 200));

if (decoded.includes('https://')) {
    console.log('\n✅ SUCCESS! Contains https://');
    
    // Extract URLs
    const urls = decoded.match(/https?:\/\/[^\s]+/g);
    if (urls) {
        console.log(`Found ${urls.length} URLs:`);
        urls.slice(0, 3).forEach((u, i) => console.log(`${i+1}. ${u.substring(0, 100)}`));
    }
}

// Also check if the key might be related to the div ID
console.log('\n--- Checking div ID relationship ---');
console.log('Div ID:', divId);
console.log('Div ID bytes:', divId.split('').map(c => c.charCodeAt(0).toString(16)).join(' '));
