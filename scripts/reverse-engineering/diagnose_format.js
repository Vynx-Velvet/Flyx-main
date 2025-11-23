const fs = require('fs');

// Read prorcp HTML
const html = fs.readFileSync('c:\\Users\\Nicks\\Desktop\\Flyx-main\\scripts\\reverse-engineering\\prorcp_page.html', 'utf8');

// Extract div content
const match = html.match(/<div id="JoAHUMCLXV"[^>]*>(.*?)<\/div>/s);
if (!match) {
    console.log('Not found');
    process.exit(1);
}

const encoded = match[1].trim();
console.log('Encoded data:', encoded.substring(0, 200) + '...');
console.log('Length:', encoded.length);

// This is the custom base64 alphabet from PlayerJS
const abc = "ABCDEFGHIJKLMabcdefghijklmNOPQRSTUVWXYZnopqrstuvwxyz";
const _keyStr = abc + "0123456789+/=";

// Custom base64 decode
function customBase64Decode(input) {
    let output = "";
    let chr1, chr2, chr3;
    let enc1, enc2, enc3, enc4;
    let i = 0;
    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
    while (i < input.length) {
        enc1 = _keyStr.indexOf(input.charAt(i++));
        enc2 = _keyStr.indexOf(input.charAt(i++));
        enc3 = _keyStr.indexOf(input.charAt(i++));
        enc4 = _keyStr.indexOf(input.charAt(i++));
        chr1 = (enc1 << 2) | (enc2 >> 4);
        chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        chr3 = ((enc3 & 3) << 6) | enc4;
        output += String.fromCharCode(chr1);
        if (enc3 != 64) output += String.fromCharCode(chr2);
        if (enc4 != 64) output += String.fromCharCode(chr3);
    }
    return output;
}

const decoded = customBase64Decode(encoded);
console.log('\nDecoded length:', decoded.length);

// Check if it starts with gzip header
console.log('First bytes (hex):', Buffer.from(decoded.substring(0, 10)).toString('hex'));
console.log('First bytes (chars):', decoded.substring(0, 20).split('').map(c => c.charCodeAt(0)).join(','));

// Try just printing it as text to see what kind of data it is
fs.writeFileSync('JoAHUMCLXV_raw.txt', decoded);
console.log('\nSaved raw decoded to: JoAHUMCLXV_raw.txt');

// Check for recognizable patterns
if (decoded.includes('http')) {
    console.log('\n✓ Contains "http" - might be plaintext!');
    const urls = decoded.match(/https?:\/\/[^\s]+/gi);
    if (urls) {
        console.log(`Found ${urls.length} URLs:`);
        urls.slice(0, 5).forEach(u => console.log(`  - ${u.substring(0, 100)}`));
    }
} else if (decoded.charCodeAt(0) === 0x1f && decoded.charCodeAt(1) === 0x8b) {
    console.log('\n✓ Starts with 1f8b - this is GZIP!');
} else if (decoded.charCodeAt(0) === 0x78) {
    console.log('\n✓ Starts with 78 - this is ZLIB/DEFLATE!');
} else {
    console.log('\n? Unknown format');
}
