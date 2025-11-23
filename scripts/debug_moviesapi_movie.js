const https = require('https');

const tmdbId = '550'; // Fight Club
const url = `https://moviesapi.club/movie/${tmdbId}`;

const options = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://moviesapi.club/'
    }
};

console.log(`Fetching ${url}...`);

https.get(url, options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        const iframeMatch = data.match(/<iframe[^>]+src=["']([^"']+)["']/);
        if (iframeMatch) {
            console.log("Found iframe:", iframeMatch[1]);
        } else {
            console.log("No iframe found.");
            console.log("Preview:", data.substring(0, 200));
        }
    });

}).on('error', (err) => {
    console.error('Error:', err.message);
});
