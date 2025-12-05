const fs = require('fs');
const html = fs.readFileSync('debug-prorcp-550.html', 'utf8');
const match = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);

const encoded = match[2];
console.log('Encoded length:', encoded.length);

// Step 1: Reverse
const reversed = encoded.split('').reverse().join('');

// Step 2: Replace URL-safe base64 chars
const replaced = reversed.replace(/-/g, '+').replace(/_/g, '/');

// Step 3: Base64 decode
const b64decoded = Buffer.from(replaced, 'base64').toString('binary');
console.log('After base64 (first 50):', b64decoded.substring(0, 50));

// Step 4: Subtract 5 from each char code
let result = '';
for (let i = 0; i < b64decoded.length; i++) {
    result += String.fromCharCode(b64decoded.charCodeAt(i) - 5);
}

console.log('\nDecoded with -5 (first 200):');
console.log(result.substring(0, 200));

// Replace placeholders
const withDomain = result
    .replace(/\{v1\}/g, 'shadowlandschronicles.com')
    .replace(/\{v2\}/g, 'shadowlandschronicles.com')
    .replace(/\{v3\}/g, 'shadowlandschronicles.com')
    .replace(/\{v4\}/g, 'shadowlandschronicles.com');

console.log('\nWith domain (first 200):');
console.log(withDomain.substring(0, 200));

// Check for URLs
if (withDomain.includes('https://')) {
    console.log('\n✅ SUCCESS! Contains HTTPS URLs');
    const urls = withDomain.split(' or ');
    console.log('Number of URLs:', urls.length);
    urls.slice(0, 3).forEach((u, i) => console.log(`URL ${i+1}:`, u.substring(0, 120)));
}
