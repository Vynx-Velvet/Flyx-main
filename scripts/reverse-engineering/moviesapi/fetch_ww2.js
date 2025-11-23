const https = require('https');
const fs = require('fs');
const path = require('path');

const url = 'https://ww2.moviesapi.to/tv/1396/1/1';
const outputDir = path.join(__dirname);

function fetchUrl(url, referer) {
    return new Promise((resolve, reject) => {
        console.log(`Fetching: ${url}`);
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': referer || 'https://moviesapi.club/'
            }
        }, (res) => {
            console.log(`Response headers for ${url}:`, res.headers);
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                console.log(`Redirecting to: ${res.headers.location}`);
                let redirectUrl = res.headers.location;
                if (redirectUrl.startsWith('/')) {
                    const u = new URL(url);
                    redirectUrl = `${u.protocol}//${u.host}${redirectUrl}`;
                }
                fetchUrl(redirectUrl, referer).then(resolve).catch(reject);
                return;
            }
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function main() {
    try {
        const html = await fetchUrl(url);
        fs.writeFileSync(path.join(outputDir, 'ww2_page.html'), html);
        console.log('Saved ww2_page.html');

        // Check for iframes
        const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/g;
        let match;
        while ((match = iframeRegex.exec(html)) !== null) {
            console.log('Found iframe src:', match[1]);
        }

        // Check for packed script
        if (html.includes('eval(function(p,a,c,k,e,d)')) {
            console.log('Found packed script!');
        } else {
            console.log('No packed script found.');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

main();
