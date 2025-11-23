const fs = require('fs');

function unpack(code) {
    function decode(p, a, c, k, e, d) {
        e = function (c) {
            return (c < a ? '' : e(parseInt(c / a))) + ((c = c % a) > 35 ? String.fromCharCode(c + 29) : c.toString(36))
        };
        if (!''.replace(/^/, String)) {
            while (c--) {
                d[e(c)] = k[c] || e(c)
            }
            k = [function (e) {
                return d[e]
            }];
            e = function () {
                return '\\w+'
            };
            c = 1
        };
        while (c--) {
            if (k[c]) {
                p = p.replace(new RegExp('\\b' + e(c) + '\\b', 'g'), k[c])
            }
        }
        return p;
    }

    // Extract the arguments from the eval(function(p,a,c,k,e,d){...}('...',...)) pattern
    const regex = /eval\(function\(p,a,c,k,e,d\)\{.+?\}\('(.+?)',(\d+),(\d+),'(.+?)'\.split\('\|'\),(\d+),(\{.+?\})\)\)/;
    // The file content might be slightly different, let's try to match the arguments
    // The file starts with eval(function(p,a,c,k,e,d)...

    // Let's try a more robust approach: extract the string inside eval() and run it (safely, by mocking eval)
    // or just extract the arguments manually if the regex is too complex.

    // Actually, since it's just a packer, we can copy the unpack function logic.
    // The arguments are p, a, c, k, e, d.
    // p is the payload
    // a is the radix
    // c is the count
    // k is the keywords (pipe separated string usually, but here it might be an array or string)
    // e is the encoder function (internal)
    // d is the decoder object/array (internal)

    // Let's try to parse the file content to find the arguments.
    const content = code.trim();

    // Find the start of the arguments: }('
    const argsStart = content.indexOf("}('");
    if (argsStart === -1) return "Could not find arguments start";

    const argsBody = content.substring(argsStart + 2, content.lastIndexOf("))"));

    // This is tricky to parse with regex because of nested quotes and escapes.
    // Let's try a different approach: use `eval` but override `eval` to return the result.
    // We need to be careful about what the code does. It usually just returns a string.
    // The code starts with `eval(function(p,a,c,k,e,d){...`.
    // We can replace `eval` with `console.log` or just assign to a variable.

    // However, the code inside might rely on browser globals if it executes immediately.
    // But the packer usually just returns the unpacked string to eval.
    // The structure is `eval(unpack_func(args))`.
    // So if we extract the `unpack_func(args)` part and run it, we get the code.

    // Let's try to construct a safe runner.

    const unpackerSrc = content.replace(/^eval/, 'return ');
    const runner = new Function(unpackerSrc);
    return runner();
}

try {
    const source = fs.readFileSync('c:\\Users\\Nicks\\Desktop\\Flyx-main\\scripts\\reverse-engineering\\pjs_drv_cast.js', 'utf8');
    // Remove comments at the top
    const cleanSource = source.replace(/^\/\/.*\r?\n/gm, '').trim();

    const unpacked = unpack(cleanSource);
    fs.writeFileSync('c:\\Users\\Nicks\\Desktop\\Flyx-main\\scripts\\reverse-engineering\\pjs_drv_cast_unpacked.js', unpacked);
    console.log('Unpacked successfully!');
} catch (e) {
    console.error('Error unpacking:', e);
}
