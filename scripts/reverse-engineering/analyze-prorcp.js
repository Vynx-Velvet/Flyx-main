const fs = require('fs');
const html = fs.readFileSync('debug-prorcp-550.html', 'utf8');
const match = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
if (match) {
    console.log('Div ID:', match[1]);
    console.log('Content length:', match[2].length);
    console.log('First 100 chars:', match[2].substring(0, 100));
    
    const encoded = match[2];
    
    // The NEW format uses a simple character substitution
    // eqqmp:// -> https:// 
    // e(101)->h(104) = +3, q(113)->t(116) = +3, m(109)->p(112) = +3, p(112)->s(115) = +3
    // But :// stays as :// so only alphanumeric chars are shifted
    
    // Let's check what characters are in the encoded string
    const charSet = new Set(encoded.split(''));
    console.log('\nUnique chars in encoded:', [...charSet].sort().join(''));
    
    // Decode with +3 for alphanumeric only
    function decodeNewFormat(str) {
        return str.split('').map(c => {
            const code = c.charCodeAt(0);
            // Lowercase letters a-z (97-122)
            if (code >= 97 && code <= 122) {
                // Wrap around: x->a, y->b, z->c
                return String.fromCharCode(((code - 97 + 3) % 26) + 97);
            }
            // Uppercase letters A-Z (65-90)
            if (code >= 65 && code <= 90) {
                return String.fromCharCode(((code - 65 + 3) % 26) + 65);
            }
            // Numbers 0-9 (48-57)
            if (code >= 48 && code <= 57) {
                return String.fromCharCode(((code - 48 + 3) % 10) + 48);
            }
            // Keep other chars as-is
            return c;
        }).join('');
    }
    
    console.log('\nDecoded (ROT3 alphanumeric):');
    const decoded = decodeNewFormat(encoded);
    console.log(decoded.substring(0, 200));
    
    // Replace placeholders
    const withDomain = decoded
        .replace(/\{v1\}/g, 'shadowlandschronicles.com')
        .replace(/\{v2\}/g, 'shadowlandschronicles.com')
        .replace(/\{v3\}/g, 'shadowlandschronicles.com')
        .replace(/\{v4\}/g, 'shadowlandschronicles.com');
    
    console.log('\nWith domain replaced:');
    console.log(withDomain.substring(0, 200));
    
    // Check for m3u8 URLs
    const urls = withDomain.match(/https?:\/\/[^\s]+/g);
    if (urls) {
        console.log('\nFound URLs:', urls.length);
        console.log('First URL:', urls[0].substring(0, 150));
    }
} else {
    console.log('No match found');
}
