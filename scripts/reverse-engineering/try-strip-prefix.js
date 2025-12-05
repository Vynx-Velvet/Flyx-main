const fs = require('fs');

const file = 'debug-prorcp-550.html';
const html = fs.readFileSync(file, 'utf8');
const match = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);

const encoded = match[2];
console.log('Original length:', encoded.length);
console.log('First char:', encoded[0], '(code:', encoded.charCodeAt(0), ')');

// Try stripping the leading =
const stripped = encoded.substring(1);
console.log('\n--- Try: Strip leading = then reverse + base64 + shift ---');

try {
    const reversed = stripped.split('').reverse().join('');
    const replaced = reversed.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(replaced, 'base64').toString('binary');
    
    console.log('Base64 decoded length:', decoded.length);
    console.log('First 50 bytes:', decoded.substring(0, 50));
    
    // Try different shifts
    for (const shift of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
        let result = '';
        for (let i = 0; i < decoded.length; i++) {
            result += String.fromCharCode(decoded.charCodeAt(i) - shift);
        }
        if (result.includes('https://')) {
            console.log(`\n✅ FOUND with shift ${shift}!`);
            console.log('First 150:', result.substring(0, 150));
            break;
        }
    }
} catch (e) {
    console.log('Error:', e.message);
}

// Also try the working file to compare
console.log('\n\n--- Compare with working file ---');
const workingHtml = fs.readFileSync('superembed-prorcp-550.html', 'utf8');
const workingMatch = workingHtml.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
const workingEncoded = workingMatch[2];

console.log('Working first char:', workingEncoded[0], '(code:', workingEncoded.charCodeAt(0), ')');
console.log('Working first 20:', workingEncoded.substring(0, 20));
console.log('New first 20:', encoded.substring(0, 20));
