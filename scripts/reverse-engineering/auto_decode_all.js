const fs = require('fs');
const path = 'c:\\Users\\Nicks\\Desktop\\Flyx-main\\scripts\\reverse-engineering\\prorcp-unpacked.js';

// Custom alphabet
var abc = "ABCDEFGHIJKLMabcdefghijklmNOPQRSTUVWXYZnopqrstuvwxyz";

var salt = {
    _keyStr: abc + "0123456789+/=",
    d: function (e) {
        var t = "";
        var n, r, i, s, o, u, a;
        var f = 0;
        e = e.replace(/[^A-Za-z0-9\+\/\=]/g, "");
        while (f < e.length) {
            s = this._keyStr.indexOf(e.charAt(f++));
            o = this._keyStr.indexOf(e.charAt(f++));
            u = this._keyStr.indexOf(e.charAt(f++));
            a = this._keyStr.indexOf(e.charAt(f++));
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
        t = salt._ud(t);
        return t
    },
    _ud: function (e) {
        var t = "";
        var n = 0;
        var r = 0;
        var c1 = 0;
        var c2 = 0;
        var c3 = 0;
        while (n < e.length) {
            r = e.charCodeAt(n);
            if (r < 128) {
                t += String.fromCharCode(r);
                n++
            } else if (r > 191 && r < 224) {
                c2 = e.charCodeAt(n + 1);
                t += String.fromCharCode((r & 31) << 6 | c2 & 63);
                n += 2
            } else {
                c2 = e.charCodeAt(n + 1);
                c3 = e.charCodeAt(n + 2);
                t += String.fromCharCode((r & 15) << 12 | (c2 & 63) << 6 | c3 & 63);
                n += 3
            }
        }
        return t
    }
};

function decode(x) {
    if (typeof x == "object") {
        x = JSON.stringify(x);
    }
    if (x.substr(0, 2) == "#1") {
        let s = x.substr(2);
        s = s.replace(/#/g, "+");
        return salt.d(s);
    } else if (x.substr(0, 2) == "#0") {
        return salt.d(x.substr(2));
    } else {
        return x;
    }
}

try {
    const content = fs.readFileSync(path, 'utf8');

    // Find all encoded strings
    const patterns = [
        /['"]#1([^'"]+)['"]/g,
        /['"]#0([^'"]+)['"]/g
    ];

    const results = {
        total: 0,
        decoded: [],
        errors: []
    };

    console.log('='.repeat(80));
    console.log('AUTOMATIC DECODER FOR PLAYERJS');
    console.log('='.repeat(80));
    console.log();

    patterns.forEach((pattern, idx) => {
        const prefix = idx === 0 ? '#1' : '#0';
        let match;

        while ((match = pattern.exec(content)) !== null) {
            results.total++;
            const encoded = prefix + match[1];

            try {
                const decoded = decode(encoded);
                results.decoded.push({
                    type: prefix,
                    encoded: encoded.substring(0, 60) + (encoded.length > 60 ? '...' : ''),
                    decoded: decoded.substring(0, 200) + (decoded.length > 200 ? '...' : ''),
                    fullDecoded: decoded,
                    position: match.index
                });
            } catch (e) {
                results.errors.push({
                    type: prefix,
                    encoded: encoded.substring(0, 60),
                    error: e.message,
                    position: match.index
                });
            }
        }
    });

    console.log(`RESULTS SUMMARY`);
    console.log('-'.repeat(80));
    console.log(`Total encoded strings found: ${results.total}`);
    console.log(`Successfully decoded: ${results.decoded.length}`);
    console.log(`Errors: ${results.errors.length}`);
    console.log();

    if (results.decoded.length > 0) {
        console.log('DECODED STRINGS:');
        console.log('='.repeat(80));

        results.decoded.forEach((item, idx) => {
            console.log();
            console.log(`[${idx + 1}] Type: ${item.type} | Position: ${item.position}`);
            console.log('-'.repeat(80));
            console.log('Encoded:', item.encoded);
            console.log();
            console.log('Decoded Preview:');
            console.log(item.decoded);
            console.log();

            // Save full decoded content
            const filename = `decoded_${idx + 1}_${item.type.replace('#', '')}_pos${item.position}.txt`;
            fs.writeFileSync(
                `c:\\Users\\Nicks\\Desktop\\Flyx-main\\scripts\\reverse-engineering\\${filename}`,
                item.fullDecoded
            );
            console.log(`✓ Full content saved to: ${filename}`);
            console.log();
        });
    }

    if (results.errors.length > 0) {
        console.log();
        console.log('ERRORS:');
        console.log('='.repeat(80));

        results.errors.forEach((item, idx) => {
            console.log(`[${idx + 1}] ${item.type} at position ${item.position}`);
            console.log(`Error: ${item.error}`);
            console.log(`String: ${item.encoded}`);
            console.log();
        });
    }

    // Save summary
    const summary = {
        timestamp: new Date().toISOString(),
        statistics: {
            total: results.total,
            decoded: results.decoded.length,
            errors: results.errors.length
        },
        decodedStrings: results.decoded.map(d => ({
            type: d.type,
            position: d.position,
            encodedPreview: d.encoded,
            decodedPreview: d.decoded
        })),
        errors: results.errors
    };

    fs.writeFileSync(
        'c:\\Users\\Nicks\\Desktop\\Flyx-main\\scripts\\reverse-engineering\\decode_summary.json',
        JSON.stringify(summary, null, 2)
    );

    console.log('='.repeat(80));
    console.log('✓ Summary saved to: decode_summary.json');
    console.log('='.repeat(80));

} catch (err) {
    console.error('ERROR:', err);
}
