const fs = require('fs');

const files = [
    'superembed-prorcp-550.html',  // Known working
    'debug-prorcp-550.html',       // Fight Club
    'debug-prorcp-1396.html',      // Breaking Bad
    'debug-prorcp-680.html'        // Pulp Fiction
];

// Base64 format decoder (reverse + base64 + subtract shift)
function decodeBase64Format(str) {
    let reversed = str.split('').reverse().join('');
    let replaced = reversed.replace(/-/g, '+').replace(/_/g, '/');
    let decodedB64 = Buffer.from(replaced, 'base64').toString('binary');
    
    // Try different shift values
    for (const shift of [5, 3, 4, 6, 2]) {
        let result = '';
        for (let i = 0; i < decodedB64.length; i++) {
            result += String.fromCharCode(decodedB64.charCodeAt(i) - shift);
        }
        if (result.includes('https://') && result.includes('.m3u8')) {
            return { decoded: result, shift };
        }
    }
    return null;
}

console.log('Comparing encoding formats and testing decoder:\n');

files.forEach(file => {
    try {
        const html = fs.readFileSync(file, 'utf8');
        const match = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
        
        if (match) {
            const divId = match[1];
            const content = match[2];
            const first20 = content.substring(0, 20);
            
            // Detect format
            let format = 'unknown';
            if (/^[0-9a-f]+$/i.test(first20)) {
                format = 'HEX';
            } else if (/^[A-Za-z0-9+/=_-]+$/.test(first20)) {
                format = 'BASE64';
            }
            
            console.log(`${file}:`);
            console.log(`  Div ID: ${divId}`);
            console.log(`  Format: ${format}`);
            console.log(`  Length: ${content.length}`);
            console.log(`  Start:  ${first20}...`);
            
            // Try to decode if BASE64
            if (format === 'BASE64') {
                const result = decodeBase64Format(content);
                if (result) {
                    console.log(`  ✅ DECODED with shift ${result.shift}`);
                    console.log(`  First URL: ${result.decoded.substring(0, 80)}...`);
                } else {
                    console.log(`  ❌ Decode failed`);
                }
            }
            console.log();
        } else {
            console.log(`${file}: No hidden div found\n`);
        }
    } catch (e) {
        console.log(`${file}: ${e.message}\n`);
    }
});
