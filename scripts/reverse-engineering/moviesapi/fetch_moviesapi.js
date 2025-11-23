const https = require('https');
const fs = require('fs');
const path = require('path');

const tmdbId = '550'; // Fight Club
const url = `https://moviesapi.club/movie/${tmdbId}`;
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
                // Handle relative redirects
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
    console.log(`Starting fetch for TMDB ID ${tmdbId}...`);
    try {
        const html = await fetchUrl(url);
        fs.writeFileSync(path.join(outputDir, 'main_page.html'), html);
        console.log('Saved main_page.html');

        // Check for iframes
        const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/g;
        let match;
        while ((match = iframeRegex.exec(html)) !== null) {
            const iframeSrc = match[1];
            console.log('Found iframe src:', iframeSrc);

            if (iframeSrc.includes('vidora.stream')) {
                console.log(`Fetching iframe: ${iframeSrc}`);
                const iframeHtml = await fetchUrl(iframeSrc, url);
                fs.writeFileSync(path.join(outputDir, 'vidora_page.html'), iframeHtml);
                console.log('Saved vidora_page.html');

                // Check for ww2 in vidora page
                if (iframeHtml.includes('ww2')) {
                    console.log('Found "ww2" in vidora page!');
                } else {
                    console.log('No "ww2" found in vidora page content.');
                }
            }
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

main();
