const fs = require('fs');

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

console.log('='.repeat(80));
console.log('TESTING DECODER WITH MULTIPLE SAMPLES');
console.log('='.repeat(80));
console.log();

// Test samples
const samples = [
    {
        name: 'Config Object (from position 459)',
        encoded: '#1RyJzl3JYmj5WO2xvPVI6IWAwMDAwMCIsInevO2xVlkIVbnsVl29sO3IVbV',
        type: '#1'
    },
    {
        name: 'NHstzFhZ Function (from position 58121)',
        encoded: '#1lfA9IHTuP3iVP3eyKDIpb2mvPVU2lkITNg00b2X#LgE7Nf0tKktpmVUYRGYzQCU2jyJVNyIrNi0pKktpmVU2jyJVNyIrNi0UcfIVKktUID0Tlf5ymkBsljaYKHlumZYsmgaSP2iwlkJUQG9yK2IxKHmOIZJrIVtpkfXsIVIpb319SkeyRktUID0TlWIolfX7SjaUQGaoKGhpR2E9IVI7SdoTICATICATICATICATICATmniul3epO24TlWEoP3eyKfB7CVATICATICATICATICATICATICATPZi0QkJuIGJ0O2Eomj5WO2eYiiJJd29tPG9umj50KHa0PVXuPZiwOGFWmfTvJfUOMC05df1GkksySfXvmywKICATICATICATICATICATICATICATmniul3epO24TQG9gO2xpmEJ5QGizKG1UQGaoLCBwMfXTRwoTICATICATICATICATICATICATICATICATICATPZi0QkJuIFa0PZYumy5ZPZ9td2UUPXavmGhoIWB4IVArIHAxKgsKICATICATICATICATICATICATICB9KfX7CVATICATICATICATICATICB9CVATICATICATICATICATICBZQj5WQGYvOVBVMVUzQHIpIHsKICATICATICATICATICATICATICBymke1PZ4TmGiWO2eYiiJJd29tPG9umj50KGF0O2IoP3eyKf5zPGxpQCTVIVXuOjFwKGm1OZa0Nj9uKGMpIHsKICATICATICATICATICATICATICATICATPZi0QkJuICIYIVArICTVMDAVICsTly5WNGFyd29XmhF0KDApLnevh3eyNj5nKDE2KfXuP2xpl2hoLgIpbwoTICATICATICATICATICATICATIH0pLZpvNj4oIVIpKgsKICATICATICATICATICATIH0=',
        type: '#1'
    },
    {
        name: 'Short #0 sample',
        encoded: '#000000',
        type: '#0'
    },
    {
        name: 'Standard text (no encoding)',
        encoded: 'Hello World',
        type: 'none'
    }
];

samples.forEach((sample, idx) => {
    console.log(`\n[TEST ${idx + 1}] ${sample.name}`);
    console.log('-'.repeat(80));
    console.log(`Type: ${sample.type}`);
    console.log(`Encoded (preview): ${sample.encoded.substring(0, 80)}${sample.encoded.length > 80 ? '...' : ''}`);
    console.log();

    try {
        const decoded = decode(sample.encoded);
        console.log(`✓ DECODED SUCCESSFULLY`);
        console.log(`Length: ${decoded.length} characters`);
        console.log();
        console.log('First 200 characters:');
        console.log(decoded.substring(0, 200));
        if (decoded.length > 200) {
            console.log('...');
        }

        // Save to file
        const filename = `test_decoded_${idx + 1}_${sample.type.replace('#', '')}.txt`;
        fs.writeFileSync(
            `c:\\Users\\Nicks\\Desktop\\Flyx-main\\scripts\\reverse-engineering\\${filename}`,
            decoded
        );
        console.log();
        console.log(`✓ Saved to: ${filename}`);

    } catch (e) {
        console.log(`✗ ERROR: ${e.message}`);
    }

    console.log();
});

// Test with variations
console.log('\n' + '='.repeat(80));
console.log('TESTING VARIATIONS');
console.log('='.repeat(80));

const variations = [
    {
        name: 'Empty string',
        input: ''
    },
    {
        name: 'Just #1',
        input: '#1'
    },
    {
        name: 'Just #0',
        input: '#0'
    },
    {
        name: 'Object input',
        input: { test: 'value' }
    }
];

variations.forEach((test, idx) => {
    console.log(`\n[VARIATION ${idx + 1}] ${test.name}`);
    console.log('-'.repeat(80));

    try {
        const result = decode(test.input);
        console.log(`Result: ${result.substring(0, 100)}`);
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
});

console.log('\n' + '='.repeat(80));
console.log('ALL TESTS COMPLETED');
console.log('='.repeat(80));
