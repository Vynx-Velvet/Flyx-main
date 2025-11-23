const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

// Configuration
const USER_DOMAIN_REPLACEMENT = "shadowlandschronicales.com";
const BASE_URL = "https://vidsrc-embed.ru";

// Helper to fetch URL
function fetchUrl(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://vidsrc-embed.ru/',
                ...headers
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ body: data, headers: res.headers, statusCode: res.statusCode }));
        });

        req.on('error', reject);
        req.end();
    });
}

// Decoding logic
// Decoding logic
function decodeLXVUMCoAHJ(str) {
    console.log("Input string length:", str.length);
    console.log("Input string start:", str.substring(0, 50));

    let reversed = str.split('').reverse().join('');
    let replaced = reversed.replace(/-/g, '+').replace(/_/g, '/');
    let decodedB64 = Buffer.from(replaced, 'base64').toString('binary');

    console.log("Decoded B64 length:", decodedB64.length);

    let result = '';
    for (let i = 0; i < decodedB64.length; i++) {
        result += String.fromCharCode(decodedB64.charCodeAt(i) - 3);
    }

    console.log("Result start:", result.substring(0, 50));
    return result;
}

// Process a single player page
async function processPlayerPage(url, name) {
    console.log(`Fetching player page for ${name}: ${url}`);
    try {
        const response = await fetchUrl(url);
        if (response.statusCode !== 200) {
            console.error(`Failed to fetch player page: ${response.statusCode}`);
            return [];
        }

        const htmlContent = response.body;
        let match;
        let encryptedString;
        let isFallback = false;

        // Check if this is the intermediate page (rcp)
        const prorcpMatch = htmlContent.match(/src:\s*['"](\/prorcp\/[^'"]+)['"]/);

        let targetContent = htmlContent;
        let targetUrl = url;

        if (prorcpMatch) {
            const prorcpUrl = `https://cloudnestra.com${prorcpMatch[1]}`;
            console.log(`Found intermediate page, fetching prorcp: ${prorcpUrl}`);

            const prorcpResponse = await fetchUrl(prorcpUrl, {
                'Referer': url
            });

            if (prorcpResponse.statusCode !== 200) {
                console.error(`Failed to fetch prorcp page: ${prorcpResponse.statusCode}`);
                return [];
            }

            targetContent = prorcpResponse.body;
            targetUrl = prorcpUrl;
            fs.writeFileSync(path.join(__dirname, `debug_prorcp_${name.replace(/\s+/g, '_')}.html`), targetContent);
        }

        // Try to find the extra script (obfuscated decoder)
        // Look for script src that looks like /path/hash.js
        const scriptMatch = targetContent.match(/<script src="(\/[a-zA-Z0-9]+\/[a-f0-9]{32}\.js\?_=\d+)"><\/script>/);
        if (scriptMatch) {
            const scriptUrl = `https://cloudnestra.com${scriptMatch[1]}`;
            console.log(`Found extra script: ${scriptUrl}`);
            // We might need to fetch this later if current decoding fails
        }

        // Extract encrypted string
        match = targetContent.match(/<div id="JoAHUMCLXV"[^>]*>(.*?)<\/div>/);

        if (!match) {
            const divRegex = /<div[^>]*id="([^"]+)"[^>]*>(.*?)<\/div>/g;
            let m;
            while ((m = divRegex.exec(targetContent)) !== null) {
                if (m[2].length > 500 && !m[2].includes('<')) {
                    match = m;
                    isFallback = true;
                    break;
                }
            }
        }

        if (!match) {
            console.log(`No encrypted content found for ${name}`);
            return [];
        }

        // Fix: if fallback, content is in group 2. If primary, content is in group 1.
        encryptedString = isFallback ? match[2] : match[1];

        console.log(`Extracted string length: ${encryptedString.length}`);

        // Try the known decoder first
        let decoded = decodeLXVUMCoAHJ(encryptedString);

        // Check if it looks like a valid source list (contains http or .m3u8)
        if (!decoded.includes('http') && !decoded.includes('.m3u8')) {
            console.log("Standard decoding failed or produced invalid result. Content might use a different encoding.");
            // Here we would ideally analyze the extra script to find the new decoder
            // For now, let's just save the encrypted string for analysis
            fs.writeFileSync(path.join(__dirname, `encrypted_${name.replace(/\s+/g, '_')}.txt`), encryptedString);
        }

        const replaced = decoded.replace(/\{v\d+\}/g, USER_DOMAIN_REPLACEMENT);
        const sources = replaced.split(' or ');

        console.log(`Found ${sources.length} sources for ${name}`);
        return sources;

    } catch (e) {
        console.error(`Error processing ${name}:`, e);
        return [];
    }
}

async function main() {
    const imdbId = 'tt0137523'; // Fight Club
    const embedUrl = `${BASE_URL}/embed/${imdbId}`;

    console.log(`Fetching embed page: ${embedUrl}`);

    try {
        const response = await fetchUrl(embedUrl);
        if (response.statusCode !== 200) {
            console.error(`Failed to fetch embed page: ${response.statusCode}`);
            return;
        }

        const embedHtml = response.body;

        // Extract servers
        // <div class="server" data-hash="...">Name</div>
        const serverRegex = /<div class="server" data-hash="([^"]+)">([^<]+)<\/div>/g;
        let match;
        const servers = [];

        while ((match = serverRegex.exec(embedHtml)) !== null) {
            servers.push({
                hash: match[1],
                name: match[2]
            });
        }

        console.log(`Found ${servers.length} servers:`, servers.map(s => s.name).join(', '));

        let allSources = [];

        for (const server of servers) {
            const playerUrl = `https://cloudnestra.com/rcp/${server.hash}`;
            const sources = await processPlayerPage(playerUrl, server.name);
            allSources = allSources.concat(sources);
        }

        // Remove duplicates
        allSources = [...new Set(allSources)];

        console.log("SOURCES_START");
        console.log(JSON.stringify(allSources, null, 2));
        console.log("SOURCES_END");

        fs.writeFileSync(path.join(__dirname, 'superembed-sources-full.json'), JSON.stringify(allSources, null, 2));
        console.log("Sources saved to superembed-sources-full.json");

    } catch (e) {
        console.error("Error in main:", e);
    }
}

main();
