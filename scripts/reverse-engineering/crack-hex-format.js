const fs = require('fs');
const crypto = require('crypto');

const file = 'debug-prorcp-1396.html';
const html = fs.readFileSync(file, 'utf8');
const match = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);

const divId = match[1];
const encoded = match[2];

console.log('=== HEX Format Analysis ===');
console.log('Div ID:', divId);
console.log('Encoded length:', encoded.length);
console.log('First 60:', encoded.substring(0, 60));

// Extract metadata from page
const dataI = html.match(/data-i="(\d+)"/);
const cuid = html.match(/cuid:"([^"]+)"/);
const scriptHash = html.match(/sV05kUlNvOdOxvtC\/([a-f0-9]+)\.js/);

const imdbNum = dataI ? dataI[1] : null;
const cuidVal = cuid ? cuid[1] : null;
const scriptVal = scriptHash ? scriptHash[1] : null;

console.log('\nPage metadata:');
console.log('IMDB num:', imdbNum);
console.log('cuid:', cuidVal);
console.log('script hash:', scriptVal);

// The target is "https://" = 68 74 74 70 73 3a 2f 2f
// Let's derive the XOR key from the first 8 bytes
function hexToBytes(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
}

const encodedBytes = hexToBytes(encoded.substring(0, 16));
const target = [0x68, 0x74, 0x74, 0x70, 0x73, 0x3a, 0x2f, 0x2f]; // "https://"

console.log('\nDeriving XOR key from "https://" target:');
console.log('Encoded bytes:', encodedBytes.map(b => b.toString(16).padStart(2, '0')).join(' '));
console.log('Target bytes: ', target.map(b => b.toString(16).padStart(2, '0')).join(' '));

const derivedKey = [];
for (let i = 0; i < 8; i++) {
    derivedKey.push(encodedBytes[i] ^ target[i]);
}
console.log('Derived key:  ', derivedKey.map(b => b.toString(16).padStart(2, '0')).join(' '));

// Try decoding with derived key
const fullBytes = hexToBytes(encoded);
let decoded = '';
for (let i = 0; i < fullBytes.length; i++) {
    decoded += String.fromCharCode(fullBytes[i] ^ derivedKey[i % derivedKey.length]);
}

console.log('\nDecoded with 8-byte derived key:');
console.log('First 150:', decoded.substring(0, 150));

if (decoded.includes('https://') && decoded.includes('.m3u8')) {
    console.log('\n✅ SUCCESS! Found valid URLs');
    const urls = decoded.match(/https?:\/\/[^\s]+/g);
    if (urls) {
        console.log('URLs found:', urls.length);
        console.log('First URL:', urls[0].substring(0, 100));
    }
} else {
    // Try longer key lengths
    console.log('\n8-byte key failed, trying longer keys...');
    
    for (const keyLen of [16, 32, 64]) {
        // Derive key assuming repeated "https://" pattern or known structure
        const extendedTarget = [];
        const pattern = 'https://tmstr5.';
        for (let i = 0; i < keyLen && i < pattern.length; i++) {
            extendedTarget.push(pattern.charCodeAt(i));
        }
        
        if (encodedBytes.length >= keyLen) {
            const extKey = [];
            for (let i = 0; i < keyLen; i++) {
                const encByte = parseInt(encoded.substr(i * 2, 2), 16);
                extKey.push(encByte ^ (extendedTarget[i] || 0));
            }
            
            let result = '';
            for (let i = 0; i < fullBytes.length; i++) {
                result += String.fromCharCode(fullBytes[i] ^ extKey[i % extKey.length]);
            }
            
            if (result.includes('https://') && result.includes('.m3u8')) {
                console.log(`\n✅ SUCCESS with ${keyLen}-byte key!`);
                console.log('First 150:', result.substring(0, 150));
                break;
            }
        }
    }
}

// Try using page metadata as key
console.log('\n--- Trying page metadata as keys ---');

function tryKeyVariations(keyBase, label) {
    const variations = [
        keyBase,
        keyBase.split('').reverse().join(''),
        crypto.createHash('md5').update(keyBase).digest('hex'),
        crypto.createHash('md5').update(keyBase).digest('hex').substring(0, 16),
    ];
    
    for (const key of variations) {
        let result = '';
        for (let i = 0; i < fullBytes.length; i++) {
            result += String.fromCharCode(fullBytes[i] ^ key.charCodeAt(i % key.length));
        }
        if (result.includes('https://')) {
            console.log(`✅ ${label}: ${result.substring(0, 100)}`);
            return true;
        }
    }
    return false;
}

if (imdbNum) tryKeyVariations(imdbNum, 'IMDB num');
if (cuidVal) tryKeyVariations(cuidVal, 'cuid');
if (scriptVal) tryKeyVariations(scriptVal, 'script hash');
tryKeyVariations(divId, 'div ID');

// Try combining keys
if (imdbNum && cuidVal) {
    tryKeyVariations(imdbNum + cuidVal, 'IMDB + cuid');
    tryKeyVariations(cuidVal + imdbNum, 'cuid + IMDB');
}
