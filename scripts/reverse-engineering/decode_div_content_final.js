const fs = require('fs');
const path = require('path');

function decodeLXVUMCoAHJ(str) {
    // 1. Reverse
    let reversed = str.split('').reverse().join('');
    // 2. Replace
    let replaced = reversed.replace(/-/g, '+').replace(/_/g, '/');
    // 3. Base64 decode
    let decodedB64 = Buffer.from(replaced, 'base64').toString('binary');
    // 4. Subtract 3
    let result = '';
    for (let i = 0; i < decodedB64.length; i++) {
        result += String.fromCharCode(decodedB64.charCodeAt(i) - 3);
    }
    return result;
}

const htmlPath = path.join(__dirname, '../../superembed-prorcp-550.html');
if (!fs.existsSync(htmlPath)) {
    console.error(`HTML file not found at ${htmlPath}`);
    process.exit(1);
}

const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const match = htmlContent.match(/<div id="JoAHUMCLXV"[^>]*>(.*?)<\/div>/);

if (!match) {
    console.error("Could not find div #JoAHUMCLXV in HTML");
    process.exit(1);
}

const encryptedString = match[1];
console.log("Encrypted string length:", encryptedString.length);

try {
    const decoded = decodeLXVUMCoAHJ(encryptedString);
    console.log("Decoded content length:", decoded.length);
    console.log("Decoded content start:", decoded.substring(0, 100));

    fs.writeFileSync(path.join(__dirname, 'JoAHUMCLXV_decoded_final.json'), decoded);
    console.log("Decoded content saved to JoAHUMCLXV_decoded_final.json");
} catch (e) {
    console.error("Error decoding:", e);
}
