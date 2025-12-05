const fs = require('fs');
const crypto = require('crypto');

const file = 'debug-prorcp-680.html';
const html = fs.readFileSync(file, 'utf8');
const match = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);

const encoded = match[2];
const divId = match[1];
const tmdbId = '680';

console.log('Looking for potential keys in the HTML page...\n');

// Find data-i attribute (IMDB ID without tt)
const dataI = html.match(/data-i="(\d+)"/);
if (dataI) console.log('data-i:', dataI[1]);

// Find cuid
const cuid = html.match(/cuid:"([^"]+)"/);
if (cuid) console.log('cuid:', cuid[1]);

// Find any hash-like strings
const hashes = html.match(/[a-f0-9]{32}/gi);
if (hashes) {
    const unique = [...new Set(hashes)];
    console.log('MD5-like hashes found:', unique.slice(0, 5));
}

// Try MD5 of TMDB ID as key
const md5Key = crypto.createHash('md5').update(tmdbId).digest('hex');
console.log('\nMD5 of TMDB ID:', md5Key);

// Base64 decode first
const reversed = encoded.split('').reverse().join('');
const replaced = reversed.replace(/-/g, '+').replace(/_/g, '/');
const decoded = Buffer.from(replaced, 'base64').toString('binary');

// Try XOR with MD5 hash
function tryXorKey(data, key, label) {
    let result = '';
    for (let i = 0; i < data.length; i++) {
        result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    if (result.includes('https://')) {
        console.log(`✅ ${label}: ${result.substring(0, 120)}`);
        return true;
    }
    return false;
}

// Try various hash-based keys
const keysToTry = [
    md5Key,
    md5Key.substring(0, 16),
    md5Key.substring(0, 8),
    cuid ? cuid[1] : null,
    dataI ? dataI[1] : null,
    divId,
].filter(Boolean);

console.log('\nTrying hash-based keys:');
for (const key of keysToTry) {
    tryXorKey(decoded, key, `Key "${key.substring(0, 20)}..."`);
}

// Check if the script filename contains a key
const scriptFile = html.match(/sV05kUlNvOdOxvtC\/([a-f0-9]+)\.js/);
if (scriptFile) {
    console.log('\nScript hash:', scriptFile[1]);
    tryXorKey(decoded, scriptFile[1], `Script hash`);
    tryXorKey(decoded, scriptFile[1].substring(0, 16), `Script hash (16)`);
}

// Try the prorcp hash from URL
const prorcpHash = html.match(/prorcp\/([A-Za-z0-9=]+)/);
if (prorcpHash) {
    console.log('\nProrcp hash:', prorcpHash[1].substring(0, 40));
    // Decode the prorcp hash
    try {
        const prorcpDecoded = Buffer.from(prorcpHash[1], 'base64').toString('utf8');
        console.log('Prorcp decoded:', prorcpDecoded.substring(0, 60));
        // The prorcp hash might contain the key
        const parts = prorcpDecoded.split(':');
        if (parts.length >= 2) {
            console.log('Prorcp parts:', parts[0].substring(0, 32), '...');
            tryXorKey(decoded, parts[0], 'Prorcp part 1');
            tryXorKey(decoded, parts[1].substring(0, 32), 'Prorcp part 2');
        }
    } catch (e) {
        console.log('Prorcp decode error:', e.message);
    }
}
