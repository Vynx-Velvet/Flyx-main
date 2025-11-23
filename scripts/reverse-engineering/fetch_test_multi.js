const https = require('https');
const fs = require('fs');
const path = require('path');

const urls = [
    'https://superembed.stream/play2.php?id=tt0137523', // Fight Club
    'https://superembed.stream/play2.php?id=550', // TMDB ID
    'https://superembed.stream/play2.php?id=tt0455275&s=1&e=1', // Prison Break
];

const options = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://vidsrc-embed.ru/'
    }
};

function fetch(url, index) {
    https.get(url, options, (res) => {
        console.log(`URL: ${url}`);
        console.log('StatusCode:', res.statusCode);

        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            console.log('Body length:', data.length);
            if (res.statusCode === 200) {
                fs.writeFileSync(path.join(__dirname, `main_page_${index}.html`), data);
                console.log(`Saved to main_page_${index}.html`);
            } else {
                console.log('Body:', data.substring(0, 100));
            }
            console.log('-------------------');
        });
    }).on('error', (e) => {
        console.error(e);
    });
}

urls.forEach((url, index) => fetch(url, index));
