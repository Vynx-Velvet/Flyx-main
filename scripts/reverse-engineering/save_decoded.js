const fs = require('fs');

const htmlContent = fs.readFileSync('c:\\Users\\Nicks\\Desktop\\Flyx-main\\scripts\\reverse-engineering\\prorcp_page.html', 'utf8');

// Extract JoAHUMCLXV content
const divMatch = htmlContent.match(/<div id="JoAHUMCLXV"[^>]*>([^<]+)<\/div>/);
let joaContent = "";
if (divMatch) {
    joaContent = divMatch[1].trim();
} else {
    console.log("Could not find JoAHUMCLXV content");
    process.exit(1);
}

// LXVUMCoAHJ logic (Reverse chunks of 3)
function decodeChunks(str) {
    const chunkSize = 3;
    const chunks = [];
    for (let i = 0; i < str.length; i += chunkSize) {
        chunks.push(str.substring(i, i + chunkSize));
    }
    return chunks.reverse().join('');
}

const chunkDecoded = decodeChunks(joaContent);
fs.writeFileSync('c:\\Users\\Nicks\\Desktop\\Flyx-main\\scripts\\reverse-engineering\\decoded_joa.txt', chunkDecoded);
console.log("Saved decoded_joa.txt");

// Standard Base64 decode
const standardAlpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
function d(e, keyStr) {
    var t = "";
    var n, r, i, s, o, u, a;
    var f = 0;
    e = e.replace(/[^A-Za-z0-9\+\/\=]/g, "");
    while (f < e.length) {
        s = keyStr.indexOf(e.charAt(f++));
        o = keyStr.indexOf(e.charAt(f++));
        u = keyStr.indexOf(e.charAt(f++));
        a = keyStr.indexOf(e.charAt(f++));
        n = s << 2 | o >> 4;
        r = (o & 15) << 4 | u >> 2;
        i = (u & 3) << 6 | a;
        t = t + String.fromCharCode(n);
        if (u != 64) {
            t = t + String.fromCharCode(r)
        }
        if (a != 64) {
            t = t + String.fromCharCode(i)
        }
    }
    return t;
}

const standardDecoded = d(chunkDecoded, standardAlpha);
fs.writeFileSync('c:\\Users\\Nicks\\Desktop\\Flyx-main\\scripts\\reverse-engineering\\decoded_standard.txt', standardDecoded);
console.log("Saved decoded_standard.txt");

// PJS Base64 decode
const pjsAlpha = "ABCDEFGHIJKLMabcdefghijklmNOPQRSTUVWXYZnopqrstuvwxyz0123456789+/=";
const pjsDecoded = d(chunkDecoded, pjsAlpha);
fs.writeFileSync('c:\\Users\\Nicks\\Desktop\\Flyx-main\\scripts\\reverse-engineering\\decoded_pjs.txt', pjsDecoded);
console.log("Saved decoded_pjs.txt");

// Search for bk in unpacked code
const unpackedCode = fs.readFileSync('c:\\Users\\Nicks\\Desktop\\Flyx-main\\scripts\\reverse-engineering\\pjs_drv_cast_unpacked.js', 'utf8');
const bkMatches = unpackedCode.match(/bk\d+/g);
if (bkMatches) {
    console.log("Found bk matches in unpacked code:", bkMatches);
} else {
    console.log("No bk matches in unpacked code.");
}
