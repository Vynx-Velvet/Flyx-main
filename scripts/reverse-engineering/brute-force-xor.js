const fs = require('fs');

const file = 'debug-prorcp-1396.html';
const html = fs.readFileSync(file, 'utf8');
const match = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);

const divId = match[1];
const encoded = match[2];

// Extract other page data
const dataI = html.match(/data-i="(\d+)"/);
const cuid = html.match(/cuid:"([^"]+)"/);
const scriptHash = html.match(/sV05kUlNvOdOxvtC\/([a-f0-9]+)\.js/);

console.log('Div ID:', divId);
console.log('data-i:', dataI ? dataI[1] : 'N/A');
console.log('cuid:', cuid ? cuid[1] : 'N/A');
console.log('script hash:', scriptHash ? scriptHash[1] : 'N/A');

function hexToBytes(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
}

const fullBytes = hexToBytes(encoded);
console.log('\nTotal bytes:', fullBytes.length);

// The expected URL pattern
const expectedPatterns = [
    'https://tmstr',
    'https://putgate',
    'https://cdn',
    '[{"file":"https://',
    '{"file":"https://'
];

// Try XOR with divId at different offsets
console.log('\n=== Testing divId XOR at different offsets ===');
for (let offset = 0; offset < 20; offset++) {
    let decoded = '';
    for (let i = 0; i < Math.min(100, fullBytes.length); i++) {
        const keyChar = divId.charCodeAt((i + offset) % divId.length);
        decoded += String.fromCharCode(fullBytes[i] ^ keyChar);
    }
    
    for (const pattern of expectedPatterns) {
        if (decoded.includes(pattern)) {
            console.log(`✅ Found at offset ${offset}!`);
            console.log('Decoded:', decoded.substring(0, 150));
            break;
        }
    }
}

// Try XOR with script hash
if (scriptHash) {
    console.log('\n=== Testing script hash XOR ===');
    const hash = scriptHash[1];
    for (let offset = 0; offset < 20; offset++) {
        let decoded = '';
        for (let i = 0; i < Math.min(100, fullBytes.length); i++) {
            const keyChar = hash.charCodeAt((i + offset) % hash.length);
            decoded += String.fromCharCode(fullBytes[i] ^ keyChar);
        }
        
        for (const pattern of expectedPatterns) {
            if (decoded.includes(pattern)) {
                console.log(`✅ Found at offset ${offset}!`);
                console.log('Decoded:', decoded.substring(0, 150));
                break;
            }
        }
    }
}

// Try XOR with cuid
if (cuid) {
    console.log('\n=== Testing cuid XOR ===');
    const cuidVal = cuid[1];
    for (let offset = 0; offset < 20; offset++) {
        let decoded = '';
        for (let i = 0; i < Math.min(100, fullBytes.length); i++) {
            const keyChar = cuidVal.charCodeAt((i + offset) % cuidVal.length);
            decoded += String.fromCharCode(fullBytes[i] ^ keyChar);
        }
        
        for (const pattern of expectedPatterns) {
            if (decoded.includes(pattern)) {
                console.log(`✅ Found at offset ${offset}!`);
                console.log('Decoded:', decoded.substring(0, 150));
                break;
            }
        }
    }
}

// Try combining divId + scriptHash
if (scriptHash) {
    console.log('\n=== Testing divId + scriptHash combined ===');
    const combinedKey = divId + scriptHash[1];
    let decoded = '';
    for (let i = 0; i < Math.min(200, fullBytes.length); i++) {
        const keyChar = combinedKey.charCodeAt(i % combinedKey.length);
        decoded += String.fromCharCode(fullBytes[i] ^ keyChar);
    }
    console.log('Combined key length:', combinedKey.length);
    console.log('Decoded:', decoded.substring(0, 200));
    
    for (const pattern of expectedPatterns) {
        if (decoded.includes(pattern)) {
            console.log(`✅ Found pattern: ${pattern}`);
        }
    }
}

// Try scriptHash + divId
if (scriptHash) {
    console.log('\n=== Testing scriptHash + divId combined ===');
    const combinedKey = scriptHash[1] + divId;
    let decoded = '';
    for (let i = 0; i < Math.min(200, fullBytes.length); i++) {
        const keyChar = combinedKey.charCodeAt(i % combinedKey.length);
        decoded += String.fromCharCode(fullBytes[i] ^ keyChar);
    }
    console.log('Combined key length:', combinedKey.length);
    console.log('Decoded:', decoded.substring(0, 200));
    
    for (const pattern of expectedPatterns) {
        if (decoded.includes(pattern)) {
            console.log(`✅ Found pattern: ${pattern}`);
        }
    }
}

// The key might be derived from the script hash in a specific way
// Let's try hex-decoding the script hash as the key
if (scriptHash) {
    console.log('\n=== Testing hex-decoded script hash as key ===');
    const hashBytes = hexToBytes(scriptHash[1]);
    let decoded = '';
    for (let i = 0; i < Math.min(200, fullBytes.length); i++) {
        decoded += String.fromCharCode(fullBytes[i] ^ hashBytes[i % hashBytes.length]);
    }
    console.log('Hash bytes length:', hashBytes.length);
    console.log('Decoded:', decoded.substring(0, 200));
    
    for (const pattern of expectedPatterns) {
        if (decoded.includes(pattern)) {
            console.log(`✅ Found pattern: ${pattern}`);
        }
    }
}

// Try reversing the script hash
if (scriptHash) {
    console.log('\n=== Testing reversed script hash ===');
    const reversedHash = scriptHash[1].split('').reverse().join('');
    let decoded = '';
    for (let i = 0; i < Math.min(200, fullBytes.length); i++) {
        const keyChar = reversedHash.charCodeAt(i % reversedHash.length);
        decoded += String.fromCharCode(fullBytes[i] ^ keyChar);
    }
    console.log('Decoded:', decoded.substring(0, 200));
}

// Try the divId reversed
console.log('\n=== Testing reversed divId ===');
const reversedDivId = divId.split('').reverse().join('');
let decoded = '';
for (let i = 0; i < Math.min(200, fullBytes.length); i++) {
    const keyChar = reversedDivId.charCodeAt(i % reversedDivId.length);
    decoded += String.fromCharCode(fullBytes[i] ^ keyChar);
}
console.log('Decoded:', decoded.substring(0, 200));
