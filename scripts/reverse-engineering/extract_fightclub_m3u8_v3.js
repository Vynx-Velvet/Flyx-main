const https = require('https');
const http = require('http');
const fs = require('fs');

// ----- PlayerJS custom decoder (same as before) -----
const abc = "ABCDEFGHIJKLMabcdefghijklmNOPQRSTUVWXYZnopqrstuvwxyz";
const salt = {
    _keyStr: abc + "0123456789+/=",
    d: function (e) {
        let t = "";
        let f = 0;
        e = e.replace(/[^A-Za-z0-9\+\/\=]/g, "");
        while (f < e.length) {
            const s = this._keyStr.indexOf(e.charAt(f++));
            const o = this._keyStr.indexOf(e.charAt(f++));
            const u = this._keyStr.indexOf(e.charAt(f++));
            const a = this._keyStr.indexOf(e.charAt(f++));
            const n = s << 2 | o >> 4;
            const r = (o & 15) << 4 | u >> 2;
            const i = (u & 3) << 6 | a;
            t += String.fromCharCode(n);
            if (u != 64) t += String.fromCharCode(r);
            if (a != 64) t += String.fromCharCode(i);
        }
        return this._ud(t);
    },
    _ud: function (e) {
        let t = "";
        let n = 0;
        while (n < e.length) {
            const r = e.charCodeAt(n);
            if (r < 128) { t += String.fromCharCode(r); n++; }
            else if (r > 191 && r < 224) { const c2 = e.charCodeAt(n + 1); t += String.fromCharCode((r & 31) << 6 | c2 & 63); n += 2; }
            else { const c2 = e.charCodeAt(n + 1); const c3 = e.charCodeAt(n + 2); t += String.fromCharCode((r & 15) << 12 | (c2 & 63) << 6 | c3 & 63); n += 3; }
        }
        return t;
    }
};
function decode(x) {
    if (typeof x === 'object') x = JSON.stringify(x);
    if (x.startsWith('#1')) { let s = x.slice(2); s = s.replace(/#/g, '+'); return salt.d(s); }
    if (x.startsWith('#0')) return salt.d(x.slice(2));
    return x;
}

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const opts = { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://vidsrc-embed.ru/', 'Accept': '*/*' } };
        client.get(url, opts, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ data, status: res.statusCode }));
        }).on('error', reject);
    });
}

async function run() {
    console.log('='.repeat(80));
    console.log('SUPEREMBED M3U8 EXTRACTION – FIGHT CLUB (full fetch & decode)');
    console.log('='.repeat(80));

    const tmdbId = '550'; // Fight Club
    const embedUrl = `https://vidsrc-embed.ru/embed/movie/${tmdbId}`;
    console.log('[1] Fetch embed page:', embedUrl);
    const embedRes = await fetchUrl(embedUrl);
    console.log(`    Received ${embedRes.data.length} bytes, status ${embedRes.status}`);
    fs.writeFileSync('embed_page_v3.html', embedRes.data);

    // Try to locate an iframe that loads the actual player (prorcp / cloudnestra)
    let playerIframe = null;
    const iframeMatch = embedRes.data.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);
    if (iframeMatch) {
        playerIframe = iframeMatch[1];
        console.log('    Found iframe src:', playerIframe);
    } else {
        console.log('    No iframe found – will search for encoded data directly in embed page');
    }

    // Helper to get full URL from possibly protocol‑relative value
    const resolveUrl = (base, maybe) => {
        if (!maybe) return null;
        if (maybe.startsWith('http')) return maybe;
        if (maybe.startsWith('//')) return 'https:' + maybe;
        // relative path
        try { const b = new URL(base); return new URL(maybe, b).href; } catch (e) { return maybe; }
    };

    // Function to process a page (HTML/JS) and extract encoded strings
    const processPage = (content, sourceName) => {
        console.log(`[${sourceName}] Searching for encoded PlayerJS strings...`);
        const patterns = [/['"]#1([A-Za-z0-9+\/=#]+)['"]/, /['"]#0([A-Za-z0-9+\/=#]+)['"]/, /decode\(['"]#1([^'"]+)['"]\)/, /decode\(['"]#0([^'"]+)['"]\)/];
        const found = [];
        for (const pat of patterns) {
            const matches = [...content.matchAll(new RegExp(pat, 'g'))];
            for (const m of matches) {
                const prefix = m[0].includes('#1') ? '#1' : '#0';
                const str = prefix + m[1];
                if (str.length > 15) found.push({ str, prefix, pos: m.index });
            }
        }
        console.log(`    Found ${found.length} candidate(s)`);
        return found;
    };

    // First, try to get encoded data from the embed page itself
    let encodedCandidates = processPage(embedRes.data, 'Embed page');

    // If none, follow the iframe (if present) and search there
    if (encodedCandidates.length === 0 && playerIframe) {
        const playerUrl = resolveUrl(embedUrl, playerIframe);
        console.log('[2] Fetch player iframe page:', playerUrl);
        const playerRes = await fetchUrl(playerUrl);
        console.log(`    Received ${playerRes.data.length} bytes, status ${playerRes.status}`);
        fs.writeFileSync('player_iframe_v3.html', playerRes.data);
        encodedCandidates = processPage(playerRes.data, 'Iframe page');
        // If still none, maybe the iframe loads a script URL – look for src="...js" inside the iframe HTML
        if (encodedCandidates.length === 0) {
            const scriptMatch = playerRes.data.match(/<script[^>]*src=["']([^"']+)["'][^>]*>/i);
            if (scriptMatch) {
                const scriptUrl = resolveUrl(playerUrl, scriptMatch[1]);
                console.log('[3] Fetch external script:', scriptUrl);
                const scriptRes = await fetchUrl(scriptUrl);
                console.log(`    Script size ${scriptRes.data.length} bytes, status ${scriptRes.status}`);
                fs.writeFileSync('external_script_v3.js', scriptRes.data);
                encodedCandidates = processPage(scriptRes.data, 'External script');
            }
        }
    }

    if (encodedCandidates.length === 0) {
        console.log('✗ No encoded strings found after all attempts.');
        return;
    }

    const m3u8List = [];
    const masterList = [];
    for (let i = 0; i < encodedCandidates.length; i++) {
        const { str, prefix, pos } = encodedCandidates[i];
        console.log(`[${i + 1}] Decoding ${prefix} string at position ${pos}`);
        let decoded;
        try { decoded = decode(str); } catch (e) { console.log('    decode error:', e.message); continue; }
        fs.writeFileSync(`decoded_candidate_${i + 1}.txt`, decoded);
        const m3u8 = decoded.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/gi);
        if (m3u8) m3u8.forEach(u => { if (!m3u8List.includes(u)) m3u8List.push(u); });
        const master = decoded.match(/https?:\/\/[^\s"']+master\.txt[^\s"']*/gi);
        if (master) master.forEach(u => { if (!masterList.includes(u)) masterList.push(u); });
    }

    console.log('\n=== Extraction Summary ===');
    console.log('M3U8 URLs found:', m3u8List.length);
    m3u8List.forEach((u, i) => console.log(` ${i + 1}. ${u}`));
    console.log('master.txt URLs found:', masterList.length);
    masterList.forEach((u, i) => console.log(` ${i + 1}. ${u}`));

    const result = { movie: 'Fight Club', tmdbId, m3u8: m3u8List, master: masterList };
    fs.writeFileSync('fightclub_extraction_v3.json', JSON.stringify(result, null, 2));
    console.log('Result saved to fightclub_extraction_v3.json');
}

run();
