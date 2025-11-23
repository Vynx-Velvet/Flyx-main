const fs = require('fs');
const path = require('path');

// Helper functions
const dechar = String.fromCharCode;

const abc = String.fromCharCode(65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122);

const sugar = function (x) {
    x = x.split(dechar(61));
    var result = '';
    var c1 = dechar(120);
    var chr;
    for (var i in x) {
        if (x.hasOwnProperty(i)) {
            var encoded = '';
            for (var j in x[i]) {
                if (x[i].hasOwnProperty(j)) {
                    encoded += (x[i][j] == c1) ? dechar(49) : dechar(48);
                }
            }
            if (encoded.length > 0) {
                chr = parseInt(encoded, 2);
                result += dechar(chr.toString(10));
            }
        }
    }
    return result.substr(0, result.length - 1);
};

const pepper = function (s, n) {
    s = s.replace(/\+/g, "#");
    s = s.replace(/#/g, "+");
    // o.y is 'xx??x?=xx?xx?='
    var oy = 'xx??x?=xx?xx?=';
    var a = sugar(oy) * n;
    if (n < 0) a += abc.length / 2;
    var r = abc.substr(a * 2) + abc.substr(0, a * 2);
    return s.replace(/[A-Za-z]/g, function (c) {
        return r.charAt(abc.indexOf(c));
    });
};

const salt = {
    d: function (r) {
        var e = this._k;
        var t = this._u(r);
        var n = [];
        for (var i = 0; i < t.length; i++) {
            var a = t.charCodeAt(i);
            var o = e.charCodeAt(i % e.length);
            n.push(String.fromCharCode(a ^ o));
        }
        return this._ud(n.join(""));
    },
    _k: "xx??x?=xx?xx?=", // This might be wrong. salt._k in the file might be different from o.y
    _u: function (e) {
        e = e.replace(/\r\n/g, "\n");
        var t = "";
        for (var n = 0; n < e.length; n++) {
            var r = e.charCodeAt(n);
            if (r < 128) { t += String.fromCharCode(r); }
            else if (r > 127 && r < 2048) { t += String.fromCharCode(r >> 6 | 192); t += String.fromCharCode(r & 63 | 128); }
            else { t += String.fromCharCode(r >> 12 | 224); t += String.fromCharCode(r >> 6 & 63 | 128); t += String.fromCharCode(r & 63 | 128); }
        }
        return t;
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
            if (r < 128) { t += String.fromCharCode(r); n++; }
            else if (r > 191 && r < 224) { c2 = e.charCodeAt(n + 1); t += String.fromCharCode((r & 31) << 6 | c2 & 63); n += 2; }
            else { c2 = e.charCodeAt(n + 1); c3 = e.charCodeAt(n + 2); t += String.fromCharCode((r & 15) << 12 | (c2 & 63) << 6 | c3 & 63); n += 3; }
        }
        return t;
    }
};

const decode = function (x) {
    if (typeof x == "object") { x = JSON.stringify(x); }
    if (x.substr(0, 2) == "#1") {
        return salt.d(pepper(x.substr(2), -1));
    } else if (x.substr(0, 2) == "#0") {
        return salt.d(x.substr(2));
    } else {
        return x;
    }
};

// Main execution
const htmlPath = path.join(__dirname, '../../superembed-prorcp-550.html');
if (!fs.existsSync(htmlPath)) {
    console.error(`HTML file not found at ${htmlPath}`);
    process.exit(1);
}

const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const match = htmlContent.match(/<div id="JoAHUMCLXV"[^>]*>(.*?)<\/div>/);
if (!match) {
    console.error("Could not find div #JoAHUMCLXV in HTML");
    process.exit(1);
}
const encryptedString = match[1];

console.log("Encrypted string length:", encryptedString.length);
console.log("Encrypted string start:", encryptedString.substring(0, 50));

try {
    const decoded = decode(encryptedString);
    console.log("Decoded content length:", decoded.length);
    console.log("Decoded content start:", decoded.substring(0, 100));

    fs.writeFileSync(path.join(__dirname, 'JoAHUMCLXV_decoded.txt'), decoded);
    console.log("Decoded content saved to JoAHUMCLXV_decoded.txt");
} catch (e) {
    console.error("Error decoding:", e);
}
