const fs = require('fs');
const path = require('path');
const https = require('https');

const vidoraPagePath = path.join(__dirname, 'vidora_page.html');
const content = fs.readFileSync(vidoraPagePath, 'utf8');

// Extract the packed script
const startMarker = "<script type='text/javascript'>eval(function(p,a,c,k,e,d)";
const endMarker = "</script>";
const startIndex = content.indexOf(startMarker);

if (startIndex === -1) {
    console.error("Could not find packed script.");
    process.exit(1);
}

const scriptContentStart = startIndex + "<script type='text/javascript'>".length;
const scriptContentEnd = content.indexOf(endMarker, scriptContentStart);
const scriptCode = content.substring(scriptContentStart, scriptContentEnd).trim();

// The code is `eval(function(...){...}(...))`
// We want to get the result of the function call, which is the unpacked string.
// So we just remove the `eval` wrapper.
const unpackExpression = scriptCode.replace(/^eval/, '');

try {
    // Execute the expression to get the unpacked code string
    const unpackedCode = eval(unpackExpression);
    console.log("Unpacked Code Length:", unpackedCode.length);

    // Extract M3U8 URL
    const fileMatch = unpackedCode.match(/file:"([^"]+)"/);
    if (fileMatch) {
        const m3u8Url = fileMatch[1];
        console.log("Found M3U8 URL:", m3u8Url);

        // Verify it with different headers
        const testHeaders = [
            { 'Referer': 'https://vidora.stream/' },
            { 'Referer': 'https://vidora.stream/embed/e5ccbb10n1xp' },
            { 'Referer': 'https://moviesapi.club/' },
            { 'Origin': 'https://vidora.stream', 'Referer': 'https://vidora.stream/' },
            { 'Cookie': 'file_id=1887; aff=1', 'Referer': 'https://vidora.stream/' }
        ];

        testHeaders.forEach((headers, index) => {
            console.log(`Test ${index + 1}: Testing headers`, headers);
            const reqHeaders = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                ...headers
            };

            https.get(m3u8Url, { headers: reqHeaders }, (res) => {
                console.log(`Test ${index + 1} Status: ${res.statusCode}`);
                if (res.statusCode === 200) {
                    console.log(`SUCCESS with headers:`, headers);
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => console.log(data.substring(0, 100)));
                }
            }).on('error', e => console.error(`Test ${index + 1} Error:`, e.message));
        });

    } else {
        console.log("Could not extract file URL via regex.");
        console.log("Unpacked code preview:", unpackedCode.substring(0, 200));
    }

} catch (e) {
    console.error("Error unpacking:", e);
}
