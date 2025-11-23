const https = require('https');
const fs = require('fs');
const path = require('path');

const assetUrl = 'https://ww2.moviesapi.to/assets/index-Wqimx1aO.js';
const outputDir = path.join(__dirname);

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        console.log(`Fetching: ${url}`);
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://ww2.moviesapi.to/'
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function main() {
    try {
        const jsCode = await fetchUrl(assetUrl);
        fs.writeFileSync(path.join(outputDir, 'ww2_index.js'), jsCode);
        console.log('Saved ww2_index.js');

        // Search for keywords
        const keywords = ['m3u8', 'api', 'embed', 'iframe', 'source', 'player'];
        keywords.forEach(kw => {
            const regex = new RegExp(kw, 'gi');
            const matches = jsCode.match(regex);
            console.log(`Keyword "${kw}": ${matches ? matches.length : 0} matches`);
        });

        // Look for API endpoints
        const apiRegex = /["']\/api\/[^"']+["']/g;
        let match;
        while ((match = apiRegex.exec(jsCode)) !== null) {
            console.log('Found API endpoint:', match[0]);
        }

        // Look for full URLs
        const urlRegex = /https?:\/\/[^"'\s]+/g;
        const urls = jsCode.match(urlRegex);
        if (urls) {
            console.log('Found URLs:', urls.slice(0, 10)); // Print first 10
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

main();
