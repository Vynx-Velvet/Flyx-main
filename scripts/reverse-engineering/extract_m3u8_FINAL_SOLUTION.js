const fs = require('fs');
const pako = require('pako');

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

// Read the prorcp page
const html = fs.readFileSync('c:\\Users\\Nicks\\Desktop\\Flyx-main\\scripts\\reverse-engineering\\prorcp_page.html', 'utf8');

// Extract the content of <div id="JoAHUMCLXV">
const match = html.match(/<div id="JoAHUMCLXV"[^>]*>(.*?)<\/div>/s);
if (!match) {
    console.log('✗ Could not find JoAHUMCLXV div');
    process.exit(1);
}

const encodedData = match[1].trim();
console.log('✓ Extracted encoded data from JoAHUMCLXV div');
console.log(`  Length: ${encodedData.length} characters`);

// Decode using custom base64
console.log('\n[Step 1] Decoding custom base64...');
const base64Decoded = salt.d(encodedData);
console.log(`✓ Decoded (${base64Decoded.length} bytes)`);

// Convert to Uint8Array for pako
console.log('\n[Step 2] Converting to binary...');
const binaryData = new Uint8Array(base64Decoded.length);
for (let i = 0; i < base64Decoded.length; i++) {
    binaryData[i] = base64Decoded.charCodeAt(i);
}

// Decompress with pako
console.log('\n[Step 3] Decompressing with pako...');
let decompressed;
try {
    decompressed = pako.inflate(binaryData, { to: 'string' });
    console.log(`✓ Decompressed successfully! (${decompressed.length} characters)`);
} catch (err) {
    console.log(`✗ Decompression failed: ${err.message}`);
    process.exit(1);
}

// Save decompressed content
fs.writeFileSync('JoAHUMCLXV_decompressed.txt', decompressed);
console.log('✓ Saved to: JoAHUMCLXV_decompressed.txt\n');

// Search for M3U8 URLs
const m3u8Urls = decompressed.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi) || [];
console.log(`\nM3U8 URLs found: ${m3u8Urls.length}`);
m3u8Urls.forEach((url, i) => console.log(`  ${i + 1}. ${url}`));

// Search for master.txt URLs
const masterUrls = decompressed.match(/https?:\/\/[^\s"'<>]+master\.txt[^\s"'<>]*/gi) || [];
console.log(`\nmaster.txt URLs found: ${masterUrls.length}`);
masterUrls.forEach((url, i) => console.log(`  ${i + 1}. ${url}`));

// Save results
const result = {
    movie: 'Fight Club',
    tmdbId: '550',
    timestamp: new Date().toISOString(),
    m3u8: m3u8Urls,
    master: masterUrls
};

fs.writeFileSync('FIGHTCLUB_FINAL_SOURCES.json', JSON.stringify(result, null, 2));
console.log('\n✓ Results saved to: FIGHTCLUB_FINAL_SOURCES.json');
console.log('\n' + '='.repeat(80));
console.log('SUCCESS! M3U8 URLs extracted from Superembed using custom decoder!');
console.log('='.repeat(80));
