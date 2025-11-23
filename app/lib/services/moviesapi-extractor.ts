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
        lastDigest = Buffer.from(digest);
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
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
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
    // Define url for logging/fallback purposes
    let url;
    if (type === 'movie') {
        url = `https://moviesapi.club/movie/${tmdbId}`;
    } else {
        url = `https://moviesapi.club/tv/${tmdbId}-${season}-${episode}`;
    }

    console.log(`[MoviesApi] Extracting for ${type} ID ${tmdbId} (${url})...`);

    try {
        let iframeSrc;

        // Optimization: Construct iframe URL directly to avoid Cloudflare on main page
        // Both movies and TV shows seem to work on ww2.moviesapi.to
        if (type === 'movie') {
            iframeSrc = `https://ww2.moviesapi.to/movie/${tmdbId}`;
        } else {
            iframeSrc = `https://ww2.moviesapi.to/tv/${tmdbId}/${season}/${episode}`;
        }
        console.log(`[MoviesApi] Constructed iframe URL: ${iframeSrc}`);

        if (iframeSrc.includes('vidora.stream')) {
            // Vidora Method (Legacy/Fallback if we ever go back to main page fetching)
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

            const unpackExpression = scriptCode.replace(/^eval/, '');

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

            const allSources: StreamSource[] = [];
            const seenUrls = new Set<string>();

            // Iterate through servers 0-3 to get multiple sources
            // This mimics the behavior of finding all available servers
            const serverPromises = [0, 1, 2, 3].map(async (srvId) => {
                try {
                    // Construct Payload
                    const payloadObj: any = {
                        source: "sflix2",
                        type: type,
                        id: tmdbId,
                        srv: srvId.toString()
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
                        return;
                    }

                    const apiData = JSON.parse(apiRes.data);
                    let videoUrl;

                    if (apiData.sources && apiData.sources.length > 0) {
                        videoUrl = apiData.sources[0].url;
                    } else if (apiData.url) {
                        videoUrl = apiData.url;
                    } else {
                        return;
                    }

                    // Apply proxy if needed (for sflix2/Apollo)
                    // But first check if the API provided specific headers
                    let streamReferer = 'https://ww2.moviesapi.to/';
                    if (apiData.referer) {
                        streamReferer = apiData.referer;
                    }

                    if (payloadObj.source === "sflix2") {
                        // Check if we can use the URL directly with the provided referer
                        // instead of forcing the proxy
                        if (apiData.referer && apiData.origin) {
                            console.log(`[MoviesApi] Source provided specific headers. Origin: ${apiData.origin}, Referer: ${apiData.referer}`);
                            // If the URL is already a proxy or direct link, we might not need to modify it
                            // But the previous issue was 502 from ax.1hd.su.
                            // Let's try to use the URL as is if it doesn't look like it needs our manual proxying
                            // OR if the manual proxying was the problem.

                            // However, the URL returned in the debug log was:
                            // https://cloudspark91.live/file2/...
                            // This domain (cloudspark91.live) might be accessible directly with the correct referer.

                            // Let's NOT force the ax.1hd.su proxy if we have a direct URL and specific headers.
                            // But we need to make sure the frontend uses these headers.
                        } else {
                            const noProtocol = videoUrl.replace(/^https?:\/\//, '');
                            videoUrl = `https://ax.1hd.su/${noProtocol}`;
                        }
                    }

                    if (!seenUrls.has(videoUrl)) {
                        // Map srv ID to descriptive name
                        const serverNames: Record<string, string> = {
                            "0": "VidCloud",
                            "1": "UpCloud",
                            "2": "VidCloud Backup",
                            "3": "UpCloud Backup"
                        };

                        const serverName = serverNames[srvId.toString()] || `Server ${srvId + 1}`;

                        seenUrls.add(videoUrl);
                        allSources.push({
                            quality: serverName,
                            url: videoUrl,
                            type: 'hls',
                            referer: streamReferer, // Use the specific referer from API
                            requiresSegmentProxy: true
                        });
                    }
                } catch (e) {
                    // Ignore errors for individual servers
                }
            });

            await Promise.all(serverPromises);

            console.log(`[MoviesApi] Found ${allSources.length} sources.`);

            if (allSources.length === 0) {
                throw new Error("No sources found on any server.");
            }

            return {
                success: true,
                sources: allSources
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
