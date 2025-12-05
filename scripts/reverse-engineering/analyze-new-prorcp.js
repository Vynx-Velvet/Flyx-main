const fs = require('fs');
const html = fs.readFileSync('debug-prorcp-550.html', 'utf8');
const match = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);

if (!match) {
    console.log('No match found');
    process.exit(1);
}

console.log('Div ID:', match[1]);
console.log('Content length:', match[2].length);
console.log('First 100 chars:', match[2].substring(0, 100));

const encoded = match[2];

// Check if it's NEW format (starts with eqqmp://)
if (encoded.startsWith('eqqmp://')) {
    console.log('\nDetected: NEW format (ROT3)');
} else {
    console.log('\nDetected: OLD format (base64)');
    
    // OLD format decoder: reverse + base64 + subtract 3
    function decodeOldFormat(str) {
        let reversed = str.split('').reverse().join('');
        let replaced = reversed.replace(/-/g, '+').replace(/_/g, '/');
        let decodedB64 = Buffer.from(replaced, 'base64').toString('binary');
        let result = '';
        for (let i = 0; i < decodedB64.length; i++) {
            result += String.fromCharCode(decodedB64.charCodeAt(i) - 3);
        }
        return result;
    }
    
    try {
        const decoded = decodeOldFormat(encoded);
        console.log('\nDecoded (first 200 chars):');
        console.log(decoded.substring(0, 200));
        
        // Replace placeholders
        const withDomain = decoded
            .replace(/\{v1\}/g, 'shadowlandschronicles.com')
            .replace(/\{v2\}/g, 'shadowlandschronicles.com')
            .replace(/\{v3\}/g, 'shadowlandschronicles.com')
            .replace(/\{v4\}/g, 'shadowlandschronicles.com');
        
        console.log('\nWith domain:');
        console.log(withDomain.substring(0, 200));
        
        // Check for URLs
        if (withDomain.includes('http')) {
            console.log('\n✅ Contains HTTP URLs');
            const urls = withDomain.split(' or ');
            console.log('Number of URLs:', urls.length);
            console.log('First URL:', urls[0].substring(0, 120));
        }
    } catch (e) {
        console.log('Decode error:', e.message);
    }
}
