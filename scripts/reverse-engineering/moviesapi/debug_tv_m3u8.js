const https = require('https');

const originalUrl = "https://hailmist36.pro/file2/URvacNgbRRt9YqnSe2X1OhO1bexc2tfhNmwmKw4E4CCThu0kDGB9AV+DL2I84pcBiL79x0ntvPxkTnz6y16gd+ii9frl98+3CtLGWmmuifEDsVqW9JtyEwwCp5yw14oGPUJvQ40XBnQ1C2RHg8fJ7KmlfNclLalMfWHzormJjXg=/cGxheWxpc3QubTN1OA==.m3u8";
const noProtocol = originalUrl.replace(/^https?:\/\//, '');
const url = `https://ax.1hd.su/${noProtocol}`;
console.log("Testing Proxy URL:", url);

const testHeaders = [
    { 'Referer': 'https://ww2.moviesapi.to/' },
    { 'Referer': 'https://moviesapi.club/' },
    { 'Referer': 'https://hailmist36.pro/' },
    { 'Origin': 'https://ww2.moviesapi.to', 'Referer': 'https://ww2.moviesapi.to/' },
    { 'Referer': 'https://ww2.moviesapi.to/tv/1396/1/1' },
    { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
    {} // No headers
];

function fetch(url, headers) {
    return new Promise((resolve) => {
        const reqHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            ...headers
        };
        https.get(url, { headers: reqHeaders }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, data }));
        }).on('error', (e) => resolve({ statusCode: 0, error: e.message }));
    });
}

async function run() {
    for (let i = 0; i < testHeaders.length; i++) {
        const headers = testHeaders[i];
        console.log(`Test ${i + 1}: Testing headers`, headers);
        const res = await fetch(url, headers);
        console.log(`Test ${i + 1} Status: ${res.statusCode}`);
        if (res.statusCode === 200) {
            console.log(`SUCCESS! Content: ${res.data.substring(0, 50)}...`);
        }
    }
}

run();
