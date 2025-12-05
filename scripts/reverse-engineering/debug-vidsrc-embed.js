const https = require('https');

const TMDB_ID = '550';

function fetch(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        https.get({
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const newUrl = res.headers.location.startsWith('http') 
                    ? res.headers.location 
                    : `${urlObj.protocol}//${urlObj.host}${res.headers.location}`;
                return fetch(newUrl).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        }).on('error', reject);
    });
}

async function main() {
    console.log('=== Fetching vidsrc-embed.ru ===\n');
    const url = `https://vidsrc-embed.ru/embed/movie/${TMDB_ID}`;
    console.log('URL:', url);
    
    const response = await fetch(url);
    console.log('Status:', response.status);
    console.log('Length:', response.data.length);
    
    console.log('\n=== Full HTML ===\n');
    console.log(response.data);
    
    console.log('\n=== Looking for URLs ===\n');
    
    // Find all URLs
    const urlMatches = response.data.match(/https?:\/\/[^\s"'<>]+/g) || [];
    console.log('URLs found:');
    urlMatches.forEach((u, i) => console.log(`${i + 1}. ${u}`));
    
    // Find iframe sources
    const iframeMatches = response.data.match(/<iframe[^>]*src=["']([^"']+)["']/gi) || [];
    console.log('\nIframe sources:');
    iframeMatches.forEach((m, i) => console.log(`${i + 1}. ${m}`));
    
    // Find script sources
    const scriptMatches = response.data.match(/<script[^>]*src=["']([^"']+)["']/gi) || [];
    console.log('\nScript sources:');
    scriptMatches.forEach((m, i) => console.log(`${i + 1}. ${m}`));
    
    // Find onclick handlers
    const onclickMatches = response.data.match(/onclick=["'][^"']+["']/gi) || [];
    console.log('\nOnclick handlers:');
    onclickMatches.forEach((m, i) => console.log(`${i + 1}. ${m}`));
    
    // Find data attributes
    const dataMatches = response.data.match(/data-[a-z-]+=["'][^"']+["']/gi) || [];
    console.log('\nData attributes:');
    dataMatches.forEach((m, i) => console.log(`${i + 1}. ${m}`));
}

main().catch(console.error);
