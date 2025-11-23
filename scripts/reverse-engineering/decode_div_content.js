const fs = require('fs');
const path = require('path');

function bMGyx71TzQLfdonN(str) {
    const chunkSize = 3;
    const chunks = [];
    for (let i = 0; i < str.length; i += chunkSize) {
        chunks.push(str.slice(i, i + chunkSize));
    }
    return chunks.reverse().join('');
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

const decoded = bMGyx71TzQLfdonN(encryptedString);
console.log("Decoded content length:", decoded.length);
console.log("Decoded content start:", decoded.substring(0, 100));

// Save to file
fs.writeFileSync(path.join(__dirname, 'JoAHUMCLXV_decoded_bMGyx.txt'), decoded);
console.log("Decoded content saved to JoAHUMCLXV_decoded_bMGyx.txt");
