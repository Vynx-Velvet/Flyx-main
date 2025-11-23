const https = require('https');
const http = require('http');
const fs = require('fs');

// ----- Custom PlayerJS decoder (from analysis) -----
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
            if (r < 128) {
                t += String.fromCharCode(r);
                n++;
            } else if (r > 191 && r < 224) {
                const c2 = e.charCodeAt(n + 1);
                t += String.fromCharCode((r & 31) << 6 | c2 & 63);
                n += 2;
            } else {
                const c2 = e.charCodeAt(n + 1);
                const c3 = e.charCodeAt(n + 2);
                t += String.fromCharCode((r & 15) << 12 | (c2 & 63) << 6 | c3 & 63);
                n += 3;
            }
        }
        return t;
    }
};
function decode(x) {
    if (typeof x === "object") x = JSON.stringify(x);
    if (x.startsWith("#1")) {
        let s = x.slice(2);
        s = s.replace(/#/g, "+");
        return salt.d(s);
    }
    if (x.startsWith("#0")) return salt.d(x.slice(2));
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
    console.log('SUPEREMBED M3U8 EXTRACTION - FIGHT CLUB (vidsrc-embed.ru)');
    console.log('='.repeat(80));

    const tmdbId = '550'; // Fight Club
    // 1. Get embed page
    const embedUrl = `https://vidsrc-embed.ru/embed/movie/${tmdbId}`;
    console.log('[1] Fetch embed page:', embedUrl);
    const embedRes = await fetchUrl(embedUrl);
    console.log(`   Received ${embedRes.data.length} bytes`);
    fs.writeFileSync('embed_page.html', embedRes.data);

    // 2. Extract data-hash (or fallback to iframe src)
    let dataHash = null;
    const hashMatch = embedRes.data.match(/data-hash=["']([^"']+)["']/);
    if (hashMatch) {
        dataHash = hashMatch[1];
        console.log('   data-hash found:', dataHash);
    } else {
        console.log('   data-hash not found, searching for iframe src');
        const iframeMatch = embedRes.data.match(/iframe[^>]*src=["']([^"']+)["']/i);
        if (iframeMatch) {
            const src = iframeMatch[1];
            console.log('   iframe src:', src);
            // try to extract hash from src query param
            const q = src.split('?')[1] || '';
            const params = new URLSearchParams(q);
            dataHash = params.get('hash') || params.get('id');
            console.log('   extracted hash from iframe:', dataHash);
        }
    }
    if (!dataHash) {
        console.error('✗ Unable to obtain data-hash');
        return;
    }

    // 3. Call API to get source URL
    const apiUrl = `https://vidsrc-embed.ru/api/source/${encodeURIComponent(dataHash)}`;
    console.log('[2] Call source API:', apiUrl);
    const apiRes = await fetchUrl(apiUrl);
    console.log(`   API response ${apiRes.status}, ${apiRes.data.length} bytes`);
    let apiJson;
    try {
        apiJson = JSON.parse(apiRes.data);
    } catch (e) {
        // try to extract JSON from HTML
        const jsonMatch = apiRes.data.match(/\{.*\}/s);
        if (jsonMatch) {
            try { apiJson = JSON.parse(jsonMatch[0]); } catch (_) { apiJson = null; }
        }
    }
    if (!apiJson) { console.error('✗ Could not parse API JSON'); return; }
    console.log('   API keys:', Object.keys(apiJson).join(','));
    if (!apiJson.url) { console.error('✗ API JSON missing url'); return; }

    // 4. Load the ProRCP page (the player script)
    const playerUrl = apiJson.url.startsWith('//') ? 'https:' + apiJson.url : apiJson.url;
    console.log('[3] Fetch player page:', playerUrl);
    const playerRes = await fetchUrl(playerUrl);
    console.log(`   Player page ${playerRes.data.length} bytes`);
    fs.writeFileSync('player_page.html', playerRes.data);

    // 5. Find encoded strings (#1 or #0) in the page
    const patterns = [/['"]#1([A-Za-z0-9+\/=#]+)['"]/, /['"]#0([A-Za-z0-9+\/=#]+)['"]/, /decode\(['"]#1([^'"]+)['"]\)/, /decode\(['"]#0([^'"]+)['"]\)/];
    const encoded = [];
    for (const pat of patterns) {
        const matches = [...playerRes.data.matchAll(new RegExp(pat, 'g'))];
        for (const m of matches) {
            const prefix = m[0].includes('#1') ? '#1' : '#0';
            const str = prefix + m[1];
            if (str.length > 15) encoded.push({ str, prefix, pos: m.index });
        }
    }
    console.log(`   Found ${encoded.length} encoded candidate(s)`);

    const m3u8List = [];
    const masterList = [];
    for (let i = 0; i < encoded.length; i++) {
        const { str, prefix, pos } = encoded[i];
        console.log(`[${i + 1}] Decoding ${prefix} string at ${pos}`);
        let decoded;
        try { decoded = decode(str); } catch (e) { console.log('   decode error', e.message); continue; }
        // Save decoded for reference
        fs.writeFileSync(`decoded_${i + 1}.txt`, decoded);
        // Search for URLs
        const m3u8 = decoded.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/gi);
        if (m3u8) {
            for (const u of m3u8) if (!m3u8List.includes(u)) m3u8List.push(u);
        }
        const master = decoded.match(/https?:\/\/[^\s"']+master\.txt[^\s"']*/gi);
        if (master) {
            for (const u of master) if (!masterList.includes(u)) masterList.push(u);
        }
    }

    console.log('\n=== Extraction Summary ===');
    console.log('M3U8 URLs found:', m3u8List.length);
    m3u8List.forEach((u, i) => console.log(` ${i + 1}. ${u}`));
    console.log('master.txt URLs found:', masterList.length);
    masterList.forEach((u, i) => console.log(` ${i + 1}. ${u}`));

    const result = { movie: 'Fight Club', tmdbId, m3u8: m3u8List, master: masterList };
    fs.writeFileSync('fightclub_extraction.json', JSON.stringify(result, null, 2));
    console.log('Result saved to fightclub_extraction.json');
}

run();
