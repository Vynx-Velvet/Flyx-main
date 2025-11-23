const fs = require('fs');
const path = require('path');
const https = require('https');

const url = 'https://superembed.stream/play2.php?id=tt0455275&s=1&e=1'; // Example URL

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

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

async function main() {
    // For this demonstration, I'll read the local HTML file instead of fetching
    // because I don't want to trigger network issues or blocks.
    // But the structure allows fetching.
    const htmlPath = path.join(__dirname, '../../superembed-prorcp-550.html');
    console.log(`Reading HTML from ${htmlPath}`);

    if (!fs.existsSync(htmlPath)) {
        console.error("HTML file not found.");
        return;
    }

    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // Extract encrypted string
    // Try to find div with ID JoAHUMCLXV
    let match = htmlContent.match(/<div id="JoAHUMCLXV"[^>]*>(.*?)<\/div>/);

    if (!match) {
        console.log("Div #JoAHUMCLXV not found. Searching for any large hidden div...");
        // Fallback: find div with style="display:none" and large content
        const divRegex = /<div[^>]*id="([^"]+)"[^>]*>(.*?)<\/div>/g;
        let m;
        while ((m = divRegex.exec(htmlContent)) !== null) {
            if (m[2].length > 1000) {
                console.log(`Found candidate div #${m[1]} with length ${m[2].length}`);
                match = m;
                break;
            }
        }
    }

    if (!match) {
        console.error("Could not find encrypted content div.");
        return;
    }

    const encryptedString = match[1];
    console.log("Encrypted string length:", encryptedString.length);

    try {
        const decoded = decodeLXVUMCoAHJ(encryptedString);
        console.log("Decoded content length:", decoded.length);

        // Split by ' or '
        const sources = decoded.split(' or ');
        console.log("SOURCES_START");
        console.log(JSON.stringify(sources, null, 2));
        console.log("SOURCES_END");

        fs.writeFileSync(path.join(__dirname, 'superembed-sources-final.json'), JSON.stringify(sources, null, 2));
        console.log("Sources saved to superembed-sources-final.json");

    } catch (e) {
        console.error("Error decoding:", e);
    }
}

main();
