const fs = require('fs');

const file = 'debug-prorcp-680.html';
const html = fs.readFileSync(file, 'utf8');
const match = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);

const encoded = match[2];
const tmdbId = '680'; // Pulp Fiction
const imdbId = 'tt0110912'; // Pulp Fiction IMDB

console.log('Testing ID-based XOR keys for Pulp Fiction (TMDB: 680, IMDB: tt0110912)');
console.log('Encoded length:', encoded.length);
console.log('First 40:', encoded.substring(0, 40));

function tryXorKey(data, key, label) {
    let result = '';
    for (let i = 0; i < data.length; i++) {
        result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    if (result.includes('https://') || result.includes('http://') || result.includes('.m3u8')) {
        console.log(`\n✅ ${label}: ${result.substring(0, 150)}`);
        return true;
    }
    return false;
}

// First decode base64
const reversed = encoded.split('').reverse().join('');
const replaced = reversed.replace(/-/g, '+').replace(/_/g, '/');
let decoded;
try {
    decoded = Buffer.from(replaced, 'base64').toString('binary');
} catch (e) {
    console.log('Base64 decode failed:', e.message);
    process.exit(1);
}

console.log('\nBase64 decoded length:', decoded.length);

// Try various ID-based keys
const keys = [
    tmdbId,
    imdbId,
    imdbId.replace('tt', ''),
    `tt${tmdbId}`,
    tmdbId.padStart(7, '0'),
    tmdbId.padStart(8, '0'),
    `${tmdbId}${tmdbId}`,
    imdbId + imdbId,
    // Reversed
    tmdbId.split('').reverse().join(''),
    imdbId.split('').reverse().join(''),
    // Combined with div ID
    'xTyBxQyGTA',
    'xTyBxQyGTA' + tmdbId,
    tmdbId + 'xTyBxQyGTA',
];

console.log('\nTrying XOR with ID-based keys on base64-decoded data:');
for (const key of keys) {
    tryXorKey(decoded, key, `Key "${key}"`);
}

// Also try on raw encoded string
console.log('\nTrying XOR on raw encoded string:');
for (const key of keys) {
    tryXorKey(encoded, key, `Raw key "${key}"`);
}

// Try shift + XOR combination
console.log('\nTrying shift then XOR:');
for (const shift of [3, 5, 7]) {
    let shifted = '';
    for (let i = 0; i < decoded.length; i++) {
        shifted += String.fromCharCode(decoded.charCodeAt(i) - shift);
    }
    for (const key of [tmdbId, imdbId]) {
        tryXorKey(shifted, key, `Shift ${shift} + XOR "${key}"`);
    }
}

// Try XOR then shift
console.log('\nTrying XOR then shift:');
for (const key of [tmdbId, imdbId]) {
    let xored = '';
    for (let i = 0; i < decoded.length; i++) {
        xored += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    for (const shift of [3, 5, 7]) {
        let result = '';
        for (let i = 0; i < xored.length; i++) {
            result += String.fromCharCode(xored.charCodeAt(i) - shift);
        }
        if (result.includes('https://')) {
            console.log(`✅ XOR "${key}" then shift ${shift}: ${result.substring(0, 100)}`);
        }
    }
}
