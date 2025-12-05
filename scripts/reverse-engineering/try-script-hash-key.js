const fs = require('fs');
const crypto = require('crypto');

const file = 'debug-prorcp-1396.html';
const html = fs.readFileSync(file, 'utf8');
const match = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);

const divId = match[1];
const encoded = match[2];

// Extract script hash
const scriptHash = html.match(/sV05kUlNvOdOxvtC\/([a-f0-9]+)\.js/);
const hash = scriptHash ? scriptHash[1] : null;

console.log('Div ID:', divId);
console.log('Script hash:', hash);

function hexToBytes(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
}

const fullBytes = hexToBytes(encoded);
console.log('Total bytes:', fullBytes.length);

// The script hash is 32 hex chars = 16 bytes when decoded
// But as a string it's 32 chars
// Let's try various key derivations

console.log('\n=== Trying script hash based keys ===\n');

// 1. Script hash as string (32 chars)
function tryKey(keyStr, name) {
    let decoded = '';
    for (let i = 0; i < Math.min(200, fullBytes.length); i++) {
        const keyByte = keyStr.charCodeAt(i % keyStr.length);
        decoded += String.fromCharCode(fullBytes[i] ^ keyByte);
    }
    
    if (decoded.includes('https://') || decoded.includes('{"file"')) {
        console.log(`✅ ${name}:`);
        console.log(`   Key: ${keyStr.substring(0, 50)}`);
        console.log(`   Decoded: ${decoded.substring(0, 150)}`);
        return true;
    }
    return false;
}

// Try hash as-is
tryKey(hash, 'Hash as string');

// Try hash + divId
tryKey(hash + divId, 'Hash + DivId');
tryKey(divId + hash, 'DivId + Hash');

// Try MD5 of various combinations
const md5 = (str) => crypto.createHash('md5').update(str).digest('hex');

tryKey(md5(divId), 'MD5(divId)');
tryKey(md5(hash), 'MD5(hash)');
tryKey(md5(divId + hash), 'MD5(divId + hash)');
tryKey(md5(hash + divId), 'MD5(hash + divId)');

// Try SHA256
const sha256 = (str) => crypto.createHash('sha256').update(str).digest('hex');
tryKey(sha256(divId).substring(0, 32), 'SHA256(divId)[0:32]');

// Try the hash bytes as key
const hashBytes = hexToBytes(hash);
let decoded = '';
for (let i = 0; i < Math.min(200, fullBytes.length); i++) {
    decoded += String.fromCharCode(fullBytes[i] ^ hashBytes[i % hashBytes.length]);
}
console.log('\nHash bytes as key:');
console.log('Decoded:', decoded.substring(0, 150));

// Try XOR of divId and hash
console.log('\n=== Trying XOR combinations ===\n');

// XOR divId with each byte of hash
for (let hashOffset = 0; hashOffset < hash.length; hashOffset++) {
    let key = '';
    for (let i = 0; i < 32; i++) {
        const divChar = divId.charCodeAt(i % divId.length);
        const hashChar = hash.charCodeAt((i + hashOffset) % hash.length);
        key += String.fromCharCode(divChar ^ hashChar);
    }
    
    let decoded = '';
    for (let i = 0; i < Math.min(200, fullBytes.length); i++) {
        decoded += String.fromCharCode(fullBytes[i] ^ key.charCodeAt(i % key.length));
    }
    
    if (decoded.includes('https://') || decoded.includes('{"file"')) {
        console.log(`✅ DivId XOR Hash (offset ${hashOffset}):`);
        console.log(`   Decoded: ${decoded.substring(0, 150)}`);
    }
}

// Try: key = divId repeated to match hash length, then XOR with hash
const divIdRepeated = divId.repeat(Math.ceil(hash.length / divId.length)).substring(0, hash.length);
let xorKey = '';
for (let i = 0; i < hash.length; i++) {
    xorKey += String.fromCharCode(divIdRepeated.charCodeAt(i) ^ hash.charCodeAt(i));
}
console.log('\nDivId XOR Hash key:', xorKey);

decoded = '';
for (let i = 0; i < Math.min(200, fullBytes.length); i++) {
    decoded += String.fromCharCode(fullBytes[i] ^ xorKey.charCodeAt(i % xorKey.length));
}
console.log('Decoded:', decoded.substring(0, 150));
