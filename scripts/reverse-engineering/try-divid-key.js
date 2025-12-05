const fs = require('fs');

const file = 'debug-prorcp-1396.html';
const html = fs.readFileSync(file, 'utf8');
const match = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);

const divId = match[1];
const encoded = match[2];

console.log('Div ID:', divId);
console.log('Encoded length:', encoded.length);

// Convert hex string to bytes
function hexToBytes(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
}

// Try XOR with div ID as key
console.log('\n--- Try 1: XOR with div ID ---');
const fullBytes = hexToBytes(encoded);
let decoded1 = '';
for (let i = 0; i < fullBytes.length; i++) {
    decoded1 += String.fromCharCode(fullBytes[i] ^ divId.charCodeAt(i % divId.length));
}
console.log('First 100:', decoded1.substring(0, 100));
if (decoded1.includes('http')) console.log('✅ Contains http!');

// Try XOR with reversed div ID
console.log('\n--- Try 2: XOR with reversed div ID ---');
const reversedId = divId.split('').reverse().join('');
let decoded2 = '';
for (let i = 0; i < fullBytes.length; i++) {
    decoded2 += String.fromCharCode(fullBytes[i] ^ reversedId.charCodeAt(i % reversedId.length));
}
console.log('First 100:', decoded2.substring(0, 100));
if (decoded2.includes('http')) console.log('✅ Contains http!');

// Look for the key in the HTML page
console.log('\n--- Looking for potential keys in HTML ---');
const scriptMatch = html.match(/var\s+(\w+)\s*=\s*["']([^"']+)["']/g);
if (scriptMatch) {
    console.log('Found variables:', scriptMatch.slice(0, 5));
}

// Look for any string that might be a key
const keyPatterns = html.match(/["'][a-zA-Z0-9]{8,32}["']/g);
if (keyPatterns) {
    console.log('Potential keys:', [...new Set(keyPatterns)].slice(0, 10));
}

// Try common keys from the page
console.log('\n--- Try 3: Common keys from page ---');
const potentialKeys = ['cloudnestra', 'prorcp', 'player', 'stream', 'video'];
for (const key of potentialKeys) {
    let decoded = '';
    for (let i = 0; i < fullBytes.length; i++) {
        decoded += String.fromCharCode(fullBytes[i] ^ key.charCodeAt(i % key.length));
    }
    if (decoded.includes('http') || decoded.includes('m3u8')) {
        console.log(`Key "${key}": ${decoded.substring(0, 100)}`);
        console.log('✅ FOUND!');
    }
}

// The key might be derived from something else
// Let's check if there's a pattern in the first few bytes
console.log('\n--- Analyzing byte patterns ---');
const first32 = fullBytes.slice(0, 32);
console.log('First 32 bytes:', first32.map(b => b.toString(16).padStart(2, '0')).join(' '));

// Check if it might be base64 encoded after hex decode
console.log('\n--- Try 4: Hex decode then base64 decode ---');
try {
    const hexDecoded = fullBytes.map(b => String.fromCharCode(b)).join('');
    const b64Decoded = Buffer.from(hexDecoded, 'base64').toString('utf8');
    console.log('First 100:', b64Decoded.substring(0, 100));
    if (b64Decoded.includes('http')) console.log('✅ Contains http!');
} catch (e) {
    console.log('Error:', e.message);
}
