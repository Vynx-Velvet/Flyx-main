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

// From your output, "https://tmstr5.{v1}/pl/H4sIAAAAAAAAA" appears at position 8
// This means bytes 8-43 decode correctly when XORed with the derived key at positions 0-35
// But the key derived from position 0 doesn't work at position 0

// Let's check if there's a header/prefix
console.log('\n=== First 16 bytes (raw hex) ===');
console.log(fullBytes.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join(' '));

// What if the first 8 bytes are a header containing the key or key info?
const header = fullBytes.slice(0, 8);
console.log('\nHeader bytes:', header.map(b => b.toString(16).padStart(2, '0')).join(' '));
console.log('Header as decimal:', header.join(', '));

// Try: data starts at byte 8, key is derived from header
console.log('\n=== Trying: Skip 8-byte header ===');
const dataBytes = fullBytes.slice(8);
const expectedUrl = 'https://tmstr';

// Derive key from expected URL at position 8
const keyFromPos8 = [];
for (let i = 0; i < expectedUrl.length; i++) {
    keyFromPos8.push(fullBytes[8 + i] ^ expectedUrl.charCodeAt(i));
}
console.log('Key derived from pos 8:', keyFromPos8.map(b => b.toString(16).padStart(2, '0')).join(' '));
console.log('Key as string:', keyFromPos8.map(b => String.fromCharCode(b)).join(''));

// Try decoding data (skipping header) with this key
let decoded1 = '';
for (let i = 0; i < dataBytes.length; i++) {
    decoded1 += String.fromCharCode(dataBytes[i] ^ keyFromPos8[i % keyFromPos8.length]);
}
console.log('\nDecoded (skip 8, key from pos8):');
console.log(decoded1.substring(0, 200));

// What if the header IS the key?
console.log('\n=== Trying: Header as XOR key ===');
let decoded2 = '';
for (let i = 0; i < dataBytes.length; i++) {
    decoded2 += String.fromCharCode(dataBytes[i] ^ header[i % header.length]);
}
console.log('Decoded (header as key):');
console.log(decoded2.substring(0, 200));

// What if key is divId?
console.log('\n=== Trying: DivId as XOR key ===');
let decoded3 = '';
for (let i = 0; i < fullBytes.length; i++) {
    decoded3 += String.fromCharCode(fullBytes[i] ^ divId.charCodeAt(i % divId.length));
}
console.log('Decoded (divId key):');
console.log(decoded3.substring(0, 200));

// What if key is divId applied to data after header?
console.log('\n=== Trying: Skip header, DivId as key ===');
let decoded4 = '';
for (let i = 0; i < dataBytes.length; i++) {
    decoded4 += String.fromCharCode(dataBytes[i] ^ divId.charCodeAt(i % divId.length));
}
console.log('Decoded:');
console.log(decoded4.substring(0, 200));

// Position-based XOR: key[i] = some_function(i)
console.log('\n=== Analyzing position-based patterns ===');

// If we know bytes 8-43 should be "https://tmstr5.{v1}/pl/H4sIAAAAAAAAA"
const knownPlaintext = 'https://tmstr5.cloudnestra.com/pl/H4sIAAAAAAAAA';
const knownStart = 8;

console.log('Deriving key from known plaintext at position', knownStart);
const derivedKeyFull = [];
for (let i = 0; i < knownPlaintext.length && (knownStart + i) < fullBytes.length; i++) {
    derivedKeyFull.push(fullBytes[knownStart + i] ^ knownPlaintext.charCodeAt(i));
}
console.log('Derived key:', derivedKeyFull.slice(0, 40).map(b => b.toString(16).padStart(2, '0')).join(' '));

// Check if this key has a pattern
console.log('\nKey byte differences (looking for arithmetic pattern):');
for (let i = 1; i < Math.min(20, derivedKeyFull.length); i++) {
    const diff = derivedKeyFull[i] - derivedKeyFull[i-1];
    console.log(`key[${i}] - key[${i-1}] = ${diff}`);
}

// Try: key might be position XOR with a constant
console.log('\n=== Trying: key[i] = i XOR constant ===');
for (let constant = 0; constant < 256; constant++) {
    let decoded = '';
    let valid = true;
    for (let i = 0; i < 50; i++) {
        const key = (i ^ constant) & 0xFF;
        const char = fullBytes[i] ^ key;
        if (i >= 8 && i < 8 + knownPlaintext.length) {
            if (char !== knownPlaintext.charCodeAt(i - 8)) {
                valid = false;
                break;
            }
        }
        decoded += String.fromCharCode(char);
    }
    if (valid && decoded.includes('https://')) {
        console.log(`Found! constant = ${constant} (0x${constant.toString(16)})`);
        console.log('Decoded:', decoded);
        break;
    }
}

// Try: key might be (i + offset) XOR constant
console.log('\n=== Trying: key[i] = (i + offset) XOR constant ===');
for (let offset = 0; offset < 256; offset++) {
    for (let constant = 0; constant < 256; constant++) {
        let valid = true;
        for (let i = 8; i < 8 + Math.min(20, knownPlaintext.length); i++) {
            const key = ((i + offset) ^ constant) & 0xFF;
            const char = fullBytes[i] ^ key;
            if (char !== knownPlaintext.charCodeAt(i - 8)) {
                valid = false;
                break;
            }
        }
        if (valid) {
            console.log(`Found! offset = ${offset}, constant = ${constant}`);
            let decoded = '';
            for (let i = 0; i < 100; i++) {
                const key = ((i + offset) ^ constant) & 0xFF;
                decoded += String.fromCharCode(fullBytes[i] ^ key);
            }
            console.log('Decoded:', decoded);
            break;
        }
    }
}
