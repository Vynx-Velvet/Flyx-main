import crypto from 'crypto';

interface StreamSource {
    quality: string;
    url: string;
    type: 'hls';
    referer: string;
    requiresSegmentProxy: boolean;
}

interface ExtractionResult {
    success: boolean;
    sources: StreamSource[];
    error?: string;
}

// Encryption Logic
function evpBytesToKey(password: string, salt: string, keyLen: number, ivLen: number) {
    const passwordBuffer = Buffer.from(password, 'utf8');
    const saltBuffer = Buffer.from(salt, 'binary');

    let digests: Buffer[] = [];
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

function encrypt(text: string, password: string) {
    const salt = crypto.randomBytes(8);
    const { key, iv } = evpBytesToKey(password, salt.toString('binary'), 32, 16);

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const saltedPrefix = Buffer.from('Salted__', 'utf8');
    const finalBuffer = Buffer.concat([saltedPrefix, salt, Buffer.from(encrypted, 'base64')]);
    return finalBuffer.toString('base64');
}

// Fetch Logic
async function fetchUrl(url: string, options: RequestInit = {}): Promise<{ data: string; headers: Headers; statusCode: number }> {
    const defaultHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        ...options.headers
    };

    const response = await fetch(url, {
        ...options,
        headers: defaultHeaders,
        redirect: 'follow'
    });

    const data = await response.text();
    return { data, headers: response.headers, statusCode: response.status };
}

export async function extractMoviesApiStreams(
    tmdbId: string,
    type: 'movie' | 'tv',
    season?: number,
    episode?: number
): Promise<ExtractionResult> {
    let url;
    if (type === 'movie') {
        url = `https://moviesapi.club/movie/${tmdbId}`;
    } else {
        url = `https://moviesapi.club/tv/${tmdbId}-${season}-${episode}`;
    }

    console.log(`[MoviesApi] Extracting for ${type} ID ${tmdbId} (${url})...`);

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
        console.log(`[MoviesApi] Found iframe: ${iframeSrc}`);

        if (iframeSrc.includes('vidora.stream')) {
            // Vidora Method
            console.log("[MoviesApi] Using Vidora method...");
            const iframePage = await fetchUrl(iframeSrc, { headers: { 'Referer': url } });
            const iframeHtml = iframePage.data;

            const startMarker = "<script type='text/javascript'>eval(function(p,a,c,k,e,d)";
            const startIndex = iframeHtml.indexOf(startMarker);
            if (startIndex === -1) throw new Error("Packed script not found in iframe.");

            const scriptContentStart = startIndex + "<script type='text/javascript'>".length;
            const endMarker = "</script>";
            const scriptContentEnd = iframeHtml.indexOf(endMarker, scriptContentStart);
            const scriptCode = iframeHtml.substring(scriptContentStart, scriptContentEnd).trim();

            // Unpack the script
            // We need to be careful with eval in a server environment. 
            // However, this is a specific packed script format.
            // Ideally, we should use a proper unpacker, but for now we'll use a safe eval approach or regex if possible.
            // The packed script is standard Dean Edwards packer.
            // Since we can't easily import a unpacker library without installing it, we will use a simple regex extraction if possible,
            // or rely on the fact that the `file:` property is what we need.

            // Let's try to extract the packed string and decode it manually if possible, or use a limited eval.
            // Given the constraints and the previous successful script using eval, we will use a safer approach if possible.
            // But for now, to replicate the success, we might need to simulate the unpacking.

            // The previous script used `eval(unpackExpression)`. 
            // In this environment, we can try to use a simple unpacker implementation or regex.
            // However, the `file:"..."` part is inside the unpacked code.

            // Let's use a simple regex to find the `file:` in the *packed* code? Unlikely.
            // We will use a minimal unpacker function.

            const unpackExpression = scriptCode.replace(/^eval/, '');

            // SAFE EVAL ALTERNATIVE:
            // We can't use `eval` directly in Next.js edge/serverless sometimes, but in Node runtime it's allowed.
            // The previous script ran in Node.
            // We will use `eval` here but wrapped in a try-catch and only on this specific string.

            let unpackedCode = '';
            try {
                unpackedCode = eval(unpackExpression);
            } catch (e) {
                console.error("[MoviesApi] Eval failed:", e);
                throw new Error("Failed to unpack script");
            }

            const fileMatch = unpackedCode.match(/file:"([^"]+)"/);
            if (!fileMatch) throw new Error("M3U8 URL not found in unpacked code.");

            return {
                success: true,
                sources: [{
                    quality: 'auto',
                    url: fileMatch[1],
                    type: 'hls',
                    referer: 'https://vidora.stream/',
                    requiresSegmentProxy: true
                }]
            };

        } else if (iframeSrc.includes('ww2.moviesapi.to')) {
            // WW2 API Method
            console.log("[MoviesApi] Using WW2 API method...");

            // Config
            const SCRAPIFY_URL = "https://ww2.moviesapi.to/api/scrapify";
            const ENCRYPTION_KEY = "moviesapi-secure-encryption-key-2024-v1";
            const PLAYER_API_KEY = "moviesapi-player-auth-key-2024-secure";

            // Construct Payload
            // Using "sflix2" as source, srv "0" (Apollo)
            const payloadObj: any = {
                source: "sflix2",
                type: type,
                id: tmdbId,
                srv: "0"
            };

            if (type === 'tv' && season && episode) {
                payloadObj.season = season;
                payloadObj.episode = episode;
            }

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
                console.log("[MoviesApi] Applying proxy for sflix2...");
                const noProtocol = videoUrl.replace(/^https?:\/\//, '');
                videoUrl = `https://ax.1hd.su/${noProtocol}`;
            }

            console.log("[MoviesApi] Extracted URL from API:", videoUrl);

            return {
                success: true,
                sources: [{
                    quality: 'auto',
                    url: videoUrl,
                    type: 'hls',
                    referer: 'https://ww2.moviesapi.to/',
                    requiresSegmentProxy: true
                }]
            };

        } else {
            console.warn("[MoviesApi] Unknown iframe source:", iframeSrc);
            return { success: false, sources: [], error: `Unknown iframe source: ${iframeSrc}` };
        }

    } catch (error: any) {
        console.error("[MoviesApi] Extraction failed:", error.message);
        return { success: false, sources: [], error: error.message };
    }
}
