const https = require('https');
const http = require('http');
const fs = require('fs');

// PlayerJS custom decoder
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
    console.log('SUPEREMBED M3U8 EXTRACTION – FIGHT CLUB');
    console.log('Using discovered PlayerJS decoding methods');
    console.log('='.repeat(80));

    const tmdbId = '550'; // Fight Club
    const embedUrl = `https://vidsrc-embed.ru/embed/movie/${tmdbId}`;
    console.log('\n[1] Fetch embed page:', embedUrl);
    const embedRes = await fetchUrl(embedUrl);
    console.log(`    ✓ Received ${embedRes.data.length} bytes`);

    // Extract RCP iframe URL
    const iframeMatch = embedRes.data.match(/<iframe[^>]*src=["']([^"']+)["']/i);
    if (!iframeMatch) {
        console.log('    ✗ No iframe found');
        return;
    }

    const iframeUrl = iframeMatch[1].startsWith('//') ? 'https:' + iframeMatch[1] : iframeMatch[1];
    console.log(`    ✓ Found RCP iframe: ${iframeUrl.substring(0, 60)}...`);

    console.log('\n[2] Fetch RCP page:', iframeUrl.substring(0, 60) + '...');
    const rcpRes = await fetchUrl(iframeUrl);
    console.log(`    ✓ Received ${rcpRes.data.length} bytes`);

    // Extract the PRORCP iframe URL with the long encoded hash
    const prorpcMatch = rcpRes.data.match(/src:\s*['"]\/prorcp\/([A-Za-z0-9+\/=\-]+)['"]/) ||
        rcpRes.data.match(/['"]\/prorcp\/([A-Za-z0-9+\/=\-]+)['"]/);

    if (!prorpcMatch) {
        console.log('    ✗ No prorcp URL found in RCP page');
        fs.writeFileSync('debug_rcp_page.html', rcpRes.data);
        console.log('    Saved to debug_rcp_page.html for inspection');
        return;
    }

    const encodedHash = prorpcMatch[1];
    console.log(`    ✓ Found encoded hash (${encodedHash.length} chars)`);

    // Construct full prorcp URL
    const prorpcUrl = `https://cloudnestra.com/prorcp/${encodedHash}`;
    console.log('\n[3] Fetch PRORCP player page:', prorpcUrl.substring(0, 60) + '...');
    const prorpcRes = await fetchUrl(prorpcUrl);
    console.log(`    ✓ Received ${prorpcRes.data.length} bytes`);
    fs.writeFileSync('prorcp_page.html', prorpcRes.data);

    // Now search for encoded strings in the PRORCP page
    console.log('\n[4] Searching for encoded PlayerJS strings in PRORCP page...');
    const patterns = [
        /['"]#1([A-Za-z0-9+\/=#]{100,})['"]/,
        /['"]#0([A-Za-z0-9+\/=#]{100,})['"]/,
        /decode\(['"]#1([^'"]{100,})['"]\)/,
        /decode\(['"]#0([^'"]{100,})['"]\)/
    ];

    const candidates = [];
    for (const pat of patterns) {
        const matches = [...prorpcRes.data.matchAll(new RegExp(pat, 'g'))];
        for (const m of matches) {
            const prefix = m[0].includes('#1') ? '#1' : '#0';
            const str = prefix + m[1];
            candidates.push({ str, prefix, pos: m.index });
        }
    }

    console.log(`    ✓ Found ${candidates.length} encoded candidate(s)`);

    if (candidates.length === 0) {
        console.log('    ✗ No encoded strings found');
        return;
    }

    const m3u8List = [];
    const masterList = [];

    console.log('\n[5] Decoding and extracting M3U8/master.txt URLs...\n');
    for (let i = 0; i < candidates.length; i++) {
        const { str, prefix } = candidates[i];
        console.log(`    [${i + 1}] Decoding ${prefix} string (${str.length} chars)`);

        let decoded;
        try {
            decoded = decode(str);
            console.log(`        ✓ Decoded successfully (${decoded.length} bytes)`);
        } catch (e) {
            console.log(`        ✗ Decode error: ${e.message}`);
            continue;
        }

        fs.writeFileSync(`decoded_${i + 1}_final.txt`, decoded);

        // Search for M3U8 URLs
        const m3u8 = decoded.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi);
        if (m3u8) {
            console.log(`        ✓ Found ${m3u8.length} M3U8 URL(s)`);
            m3u8.forEach(url => {
                if (!m3u8List.includes(url)) {
                    m3u8List.push(url);
                    console.log(`          - ${url}`);
                }
            });
        }

        // Search for master.txt URLs
        const master = decoded.match(/https?:\/\/[^\s"'<>]+master\.txt[^\s"'<>]*/gi);
        if (master) {
            console.log(`        ✓ Found ${master.length} master.txt URL(s)`);
            master.forEach(url => {
                if (!masterList.includes(url)) {
                    masterList.push(url);
                    console.log(`          - ${url}`);
                }
            });
        }

        console.log('');
    }

    console.log('\n' + '='.repeat(80));
    console.log('EXTRACTION COMPLETE');
    console.log('='.repeat(80));
    console.log(`\nM3U8 URLs found: ${m3u8List.length}`);
    m3u8List.forEach((url, i) => console.log(`  ${i + 1}. ${url}`));

    console.log(`\nmaster.txt URLs found: ${masterList.length}`);
    masterList.forEach((url, i) => console.log(`  ${i + 1}. ${url}`));

    const result = {
        movie: 'Fight Club',
        tmdbId,
        timestamp: new Date().toISOString(),
        m3u8: m3u8List,
        master: masterList
    };

    fs.writeFileSync('fightclub_sources.json', JSON.stringify(result, null, 2));
    console.log('\n✓ Results saved to: fightclub_sources.json');
    console.log('='.repeat(80));
}

run().catch(err => {
    console.error('\n✗ ERROR:', err.message);
    console.error(err.stack);
});
