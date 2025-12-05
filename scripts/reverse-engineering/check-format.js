const fs = require('fs');

const html = fs.readFileSync('debug-prorcp-1396.html', 'utf8');
const match = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);

const encoded = match[2];
console.log('First 100 chars:', encoded.substring(0, 100));
console.log('Has g:', encoded.includes('g'));
console.log('Has colon:', encoded.includes(':'));
console.log('Unique chars:', [...new Set(encoded)].sort().join(''));
console.log('Length:', encoded.length);

// Check if it's standard hex
const isStandardHex = /^[0-9a-f]+$/i.test(encoded);
console.log('Is standard hex:', isStandardHex);

// Check if it's the old format (with g and :)
const isOldFormat = encoded.includes('g') || encoded.includes(':');
console.log('Is old format:', isOldFormat);
