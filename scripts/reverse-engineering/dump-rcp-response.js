const https = require('https');
const fs = require('fs');

const TMDB_ID = '550';

function fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        https.get({
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                ...options.headers
            }
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const newUrl = res.headers.location.startsWith('http') 
                    ? res.headers.location 
                    : `${urlObj.protocol}//${urlObj.host}${res.headers.location}`;
                return fetch(newUrl, options).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        }).on('error', reject);
    });
}

async function main() {
    // Get vidsrc-embed page
    const embedUrl = `https://vidsrc-embed.ru/embed/movie/${TMDB_ID}`;
    const embedResponse = await fetch(embedUrl);
    
    // Extract the iframe src
    const iframeMatch = embedResponse.data.match(/<iframe[^>]*src=["']([^"']+cloudnestra\.com\/rcp\/([^"']+))["']/i);
    if (!iframeMatch) {
        console.log('No iframe found');
        return;
    }
    
    const rcpPath = iframeMatch[2];
    console.log('RCP hash:', rcpPath.substring(0, 50) + '...');
    
    // Fetch RCP page
    const rcpUrl = `https://cloudnestra.com/rcp/${rcpPath}`;
    const rcpResponse = await fetch(rcpUrl, {
        headers: { 'Referer': 'https://vidsrc-embed.ru/' }
    });
    
    console.log('Status:', rcpResponse.status);
    console.log('Length:', rcpResponse.data.length);
    
    // Save to file
    fs.writeFileSync('rcp-response-fresh.html', rcpResponse.data);
    console.log('Saved to rcp-response-fresh.html');
    
    // Show full content
    console.log('\n=== Full Response ===\n');
    console.log(rcpResponse.data);
}

main().catch(console.error);
