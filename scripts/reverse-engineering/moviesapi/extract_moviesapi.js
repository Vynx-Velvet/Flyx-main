const https = require('https');
const crypto = require('crypto');

// Encryption Logic
function evpBytesToKey(password, salt, keyLen, ivLen) {
    const passwordBuffer = Buffer.from(password, 'utf8');
    const saltBuffer = Buffer.from(salt, 'binary');

    let digests = [];
    let genLen = 0;
    let lastDigest = Buffer.alloc(0);

    while (genLen < keyLen + ivLen) {
        const hash = crypto.createHash('md5');
        hash.update(lastDigest);
        hash.update(passwordBuffer);
        hash.update(saltBuffer);
        const digest = hash.digest();
        digests.push(digest);
        lastDigest = digest;
        genLen += digest.length;
    }

    const combined = Buffer.concat(digests);
    const key = combined.slice(0, keyLen);
    const iv = combined.slice(keyLen, keyLen + ivLen);
    return { key, iv };
}

function encrypt(text, password) {
    const salt = crypto.randomBytes(8);
    const { key, iv } = evpBytesToKey(password, salt, 32, 16);

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const saltedPrefix = Buffer.from('Salted__', 'utf8');
    const finalBuffer = Buffer.concat([saltedPrefix, salt, Buffer.from(encrypted, 'base64')]);
    return finalBuffer.toString('base64');
}

// Fetch Logic
function fetchUrl(url, options = {}) {
    return new Promise((resolve, reject) => {
        const defaultHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            ...options.headers
        };

        const reqOptions = {
            method: options.method || 'GET',
            headers: defaultHeaders
        };

        const req = https.request(url, reqOptions, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                let redirectUrl = res.headers.location;
                if (redirectUrl.startsWith('/')) {
                    const u = new URL(url);
                    redirectUrl = `${u.protocol}//${u.host}${redirectUrl}`;
                }
                fetchUrl(redirectUrl, options).then(resolve).catch(reject);
                return;
            }
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ data, headers: res.headers, statusCode: res.statusCode }));
        });

        req.on('error', reject);

        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

async function extractM3U8(tmdbId, type = 'movie', season = 1, episode = 1) {
    let url;
    if (type === 'movie') {
        url = `https://moviesapi.club/movie/${tmdbId}`;
    } else {
        url = `https://moviesapi.club/tv/${tmdbId}-${season}-${episode}`;
    }

    console.log(`Extracting for ${type} ID ${tmdbId} (${url})...`);

    try {
        // Step 1: Fetch Main Page
        const mainPage = await fetchUrl(url, { headers: { 'Referer': 'https://moviesapi.club/' } });
        const html = mainPage.data;

        // Step 2: Find Iframe
        const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/);
        if (!iframeMatch) {
            throw new Error("No iframe found on main page.");
        }
        const iframeSrc = iframeMatch[1];
        console.log(`Found iframe: ${iframeSrc}`);

        if (iframeSrc.includes('vidora.stream')) {
            // Vidora Method
            console.log("Using Vidora method...");
            const iframePage = await fetchUrl(iframeSrc, { headers: { 'Referer': url } });
            const iframeHtml = iframePage.data;

            const startMarker = "<script type='text/javascript'>eval(function(p,a,c,k,e,d)";
            const startIndex = iframeHtml.indexOf(startMarker);
            if (startIndex === -1) throw new Error("Packed script not found in iframe.");

            const scriptContentStart = startIndex + "<script type='text/javascript'>".length;
            const endMarker = "</script>";
            const scriptContentEnd = iframeHtml.indexOf(endMarker, scriptContentStart);
            const scriptCode = iframeHtml.substring(scriptContentStart, scriptContentEnd).trim();

            const unpackExpression = scriptCode.replace(/^eval/, '');
            const unpackedCode = eval(unpackExpression);

            const fileMatch = unpackedCode.match(/file:"([^"]+)"/);
            if (!fileMatch) throw new Error("M3U8 URL not found in unpacked code.");

            return {
                url: fileMatch[1],
                headers: {
                    'Origin': 'https://vidora.stream',
                    'Referer': 'https://vidora.stream/'
                }
            };

        } else if (iframeSrc.includes('ww2.moviesapi.to')) {
            // WW2 API Method
            console.log("Using WW2 API method...");

            // Config
            const SCRAPIFY_URL = "https://ww2.moviesapi.to/api/scrapify";
            const ENCRYPTION_KEY = "moviesapi-secure-encryption-key-2024-v1";
            const PLAYER_API_KEY = "moviesapi-player-auth-key-2024-secure";

            // Construct Payload
            // Using "sflix2" as source, srv "0" (Apollo)
            const payloadObj = {
                source: "sflix2",
                type: type,
                id: tmdbId,
                ...(type === 'tv' && { season: parseInt(season), episode: parseInt(episode) }),
                srv: "0"
            };

            const encryptedPayload = encrypt(JSON.stringify(payloadObj), ENCRYPTION_KEY);

            // Call API
            const apiRes = await fetchUrl(`${SCRAPIFY_URL}/v1/fetch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-player-key': PLAYER_API_KEY,
                    'Referer': iframeSrc
                },
                body: JSON.stringify({ payload: encryptedPayload })
            });

            if (apiRes.statusCode !== 200) {
                throw new Error(`API returned ${apiRes.statusCode}: ${apiRes.data}`);
            }

            const apiData = JSON.parse(apiRes.data);
            let videoUrl;

            if (apiData.sources && apiData.sources.length > 0) {
                videoUrl = apiData.sources[0].url;
            } else if (apiData.url) {
                videoUrl = apiData.url;
            } else {
                throw new Error("No URL found in API response.");
            }

            // Apply proxy if needed (for sflix2/Apollo)
            if (payloadObj.source === "sflix2") {
                console.log("Applying proxy for sflix2...");
                const noProtocol = videoUrl.replace(/^https?:\/\//, '');
                videoUrl = `https://ax.1hd.su/${noProtocol}`;
            }

            console.log("Extracted URL from API:", videoUrl);
            return {
                url: videoUrl,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Referer': 'https://ww2.moviesapi.to/',
                    'Origin': 'https://ww2.moviesapi.to'
                }
            };

        } else {
            console.warn("Unknown iframe source:", iframeSrc);
            return null;
        }

    } catch (error) {
        console.error("Extraction failed:", error.message);
        return null;
    }
}

// Test
async function runTests() {
    console.log("--- Test 1: Movie (Fight Club) ---");
    const movieResult = await extractM3U8('550', 'movie');
    if (movieResult) {
        console.log("Movie Success!");
        await verifyUrl(movieResult.url, movieResult.headers);
    }

    console.log("\n--- Test 2: TV Show (Breaking Bad S1E1) ---");
    const tvResult = await extractM3U8('1396', 'tv', 1, 1);
    if (tvResult) {
        console.log("TV Show Success!");
        await verifyUrl(tvResult.url, tvResult.headers);
    }
}

async function verifyUrl(url, headers) {
    console.log("Verifying URL...");
    let res = await fetchUrl(url, { headers });

    if (res.statusCode === 200) {
        console.log("Verification Status: 200 OK");
        console.log("Content Preview:", res.data.substring(0, 100).replace(/\n/g, ' '));
        return;
    }

    console.log(`Verification Failed: ${res.statusCode}`);
}

runTests();
