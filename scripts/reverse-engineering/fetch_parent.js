const https = require('https');
const fs = require('fs');
const path = require('path');

const urls = [
    'https://vidsrc-embed.ru/play?id=tt0137523',
    'https://vidsrc-embed.ru/embed/tt0137523',
    'https://superembed.stream/pe/tt0137523',
];

const options = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
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
                fs.writeFileSync(path.join(__dirname, `parent_page_${index}.html`), data);
                console.log(`Saved to parent_page_${index}.html`);
            }
            console.log('-------------------');
        });
    }).on('error', (e) => {
        console.error(e);
    });
}

urls.forEach((url, index) => fetch(url, index));
