const zlib = require('zlib');
const fs = require('fs');

// PlayerJS decoder
const abc = "ABCDEFGHIJKLMabcdefghijklmNOPQRSTUVWXYZnopqrstuvwxyz";
const _keyStr = abc + "0123456789+/=";

function customDecode(input) {
    let output = "";
    let i = 0;
    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
    while (i < input.length) {
        const enc1 = _keyStr.indexOf(input.charAt(i++));
        const enc2 = _keyStr.indexOf(input.charAt(i++));
        const enc3 = _keyStr.indexOf(input.charAt(i++));
        const enc4 = _keyStr.indexOf(input.charAt(i++));
        const chr1 = (enc1 << 2) | (enc2 >> 4);
        const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        const chr3 = ((enc3 & 3) << 6) | enc4;
        output += String.fromCharCode(chr1);
        if (enc3 != 64) output += String.fromCharCode(chr2);
        if (enc4 != 64) output += String.fromCharCode(chr3);
    }
    return output;
}

// Read HTML and extract encoded data
const html = fs.readFileSync('c:\\Users\\Nicks\\Desktop\\Flyx-main\\scripts\\reverse-engineering\\prorcp_page.html', 'utf8');
const match = html.match(/<div id="JoAHUMCLXV"[^>]*>(.*?)<\/div>/s);
const encoded = match[1].trim();

console.log('Step 1: Custom base64 decode...');
const b64decoded = customDecode(encoded);
console.log(`Decoded ${b64decoded.length} bytes`);

// Convert to Buffer
const buffer = Buffer.from(b64decoded, 'binary');

console.log(`\nStep 2: Trying zlib decompression methods...`);

// Try inflateRaw
try {
    const result = zlib.inflateRawSync(buffer).toString();
    console.log(`✓ inflateRaw SUCCESS! (${result.length} chars)\n`);
    fs.writeFileSync('DECOMPRESSED.txt', result);

    // Find M3U8 URLs
    const m3u8 = result.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi) || [];
    const master = result.match(/https?:\/\/[^\s"'<>]+master\.txt[^\s"'<>]*/gi) || [];

    console.log(`M3U8 URLs: ${m3u8.length}`);
    m3u8.forEach((u, i) => console.log(`${i + 1}. ${u}`));
    console.log(`\nmaster.txt URLs: ${master.length}`);
    master.forEach((u, i) => console.log(`${i + 1}. ${u}`));

    fs.writeFileSync('FIGHTCLUB_SOURCES.json', JSON.stringify({ m3u8, master }, null, 2));
    process.exit(0);
} catch (e) { console.log(`inflateRaw failed: ${e.message}`); }

// Try unzip
try {
    const result = zlib.unzipSync(buffer).toString();
    console.log(`✓ unzip SUCCESS! (${result.length} chars)`);
    fs.writeFileSync('DECOMPRESSED.txt', result);
    process.exit(0);
} catch (e) { console.log(`unzip failed: ${e.message}`); }

// Try gunzip  
try {
    const result = zlib.gunzipSync(buffer).toString();
    console.log(`✓ gunzip SUCCESS! (${result.length} chars)`);
    fs.writeFileSync('DECOMPRESSED.txt', result);
    process.exit(0);
} catch (e) { console.log(`gunzip failed: ${e.message}`); }

// Try inflate
try {
    const result = zlib.inflateSync(buffer).toString();
    console.log(`✓ inflate SUCCESS! (${result.length} chars)`);
    fs.writeFileSync('DECOMPRESSED.txt', result);
    process.exit(0);
} catch (e) { console.log(`inflate failed: ${e.message}`); }

console.log('\n✗ ALL methods failed');
