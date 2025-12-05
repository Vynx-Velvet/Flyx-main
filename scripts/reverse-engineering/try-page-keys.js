const fs = require('fs');

const file = 'debug-prorcp-680.html';
const html = fs.readFileSync(file, 'utf8');
const match = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);

const encoded = match[2];
const divId = match[1];
const imdbNum = '0110912';
const cuid = 'd2cae9a69b6d7edcc414037aa3530309';
const scriptHash = '07d708a0a39d7c4a97417b9b70a9fdfc';

console.log('Trying keys found in page...');
console.log('IMDB num:', imdbNum);
console.log('cuid:', cuid);
console.log('Script hash:', scriptHash);
console.log('Div ID:', divId);

// Base64 decode
const reversed = encoded.split('').reverse().join('');
const replaced = reversed.replace(/-/g, '+').replace(/_/g, '/');
const decoded = Buffer.from(replaced, 'base64').toString('binary');

function tryXorWithShift(data, key, shift, label) {
    let xored = '';
    for (let i = 0; i < data.length; i++) {
        xored += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    let result = '';
    for (let i = 0; i < xored.length; i++) {
        result += String.fromCharCode(xored.charCodeAt(i) - shift);
    }
    if (result.includes('https://')) {
        console.log(`✅ ${label}: ${result.substring(0, 120)}`);
        return true;
    }
    return false;
}

function tryShiftWithXor(data, shift, key, label) {
    let shifted = '';
    for (let i = 0; i < data.length; i++) {
        shifted += String.fromCharCode(data.charCodeAt(i) - shift);
    }
    let result = '';
    for (let i = 0; i < shifted.length; i++) {
        result += String.fromCharCode(shifted.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    if (result.includes('https://')) {
        console.log(`✅ ${label}: ${result.substring(0, 120)}`);
        return true;
    }
    return false;
}

const keys = [imdbNum, cuid, scriptHash, divId, cuid.substring(0, 16), scriptHash.substring(0, 16)];
const shifts = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

console.log('\n--- XOR then shift ---');
for (const key of keys) {
    for (const shift of shifts) {
        tryXorWithShift(decoded, key, shift, `XOR "${key.substring(0, 12)}..." shift ${shift}`);
    }
}

console.log('\n--- Shift then XOR ---');
for (const shift of shifts) {
    for (const key of keys) {
        tryShiftWithXor(decoded, shift, key, `Shift ${shift} XOR "${key.substring(0, 12)}..."`);
    }
}

// Try hex-decoding the cuid/scriptHash as bytes for XOR
console.log('\n--- Hex key as bytes ---');
function hexToBytes(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return String.fromCharCode(...bytes);
}

const cuidBytes = hexToBytes(cuid);
const scriptBytes = hexToBytes(scriptHash);

for (const shift of [0, 3, 5, 7]) {
    let shifted = '';
    for (let i = 0; i < decoded.length; i++) {
        shifted += String.fromCharCode(decoded.charCodeAt(i) - shift);
    }
    
    // XOR with hex-decoded key
    let result1 = '';
    for (let i = 0; i < shifted.length; i++) {
        result1 += String.fromCharCode(shifted.charCodeAt(i) ^ cuidBytes.charCodeAt(i % cuidBytes.length));
    }
    if (result1.includes('https://')) {
        console.log(`✅ Shift ${shift} + cuid bytes: ${result1.substring(0, 100)}`);
    }
    
    let result2 = '';
    for (let i = 0; i < shifted.length; i++) {
        result2 += String.fromCharCode(shifted.charCodeAt(i) ^ scriptBytes.charCodeAt(i % scriptBytes.length));
    }
    if (result2.includes('https://')) {
        console.log(`✅ Shift ${shift} + script bytes: ${result2.substring(0, 100)}`);
    }
}
