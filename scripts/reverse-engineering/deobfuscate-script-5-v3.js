const fs = require('fs');
const path = require('path');
const vm = require('vm');

const inputFile = path.join(__dirname, 'extracted-script-5.js');
let source = fs.readFileSync(inputFile, 'utf8');

if (source.charCodeAt(0) === 0xFEFF) {
    source = source.slice(1);
}

const splitString = '),function(){';
const splitIndex = source.indexOf(splitString);

if (splitIndex === -1) {
    console.error("Could not find split point.");
    process.exit(1);
}

const headerEndIndex = splitIndex + 1;
let header = source.substring(0, headerEndIndex);

// Check for anti-tamper pattern
const antiTamperRegex = /new _0x556ec0\(_0x32e7\)\['ahGfRn'\]\(\)/g;
if (antiTamperRegex.test(header)) {
    console.log("Anti-tamper pattern found. Replacing...");
    header = header.replace(antiTamperRegex, 'null');
} else {
    console.warn("Anti-tamper pattern NOT found. Regex might be wrong.");
}

// Append assignment to global
header += '; global.decoder = _0x32e7; global.array = _0x5bd0;';

console.log("Executing header...");

const sandbox = { global: {} };
vm.createContext(sandbox);

try {
    vm.runInContext(header, sandbox);

    const decoder = sandbox.global.decoder;
    if (typeof decoder !== 'function') {
        throw new Error("Decoder not found in sandbox.");
    }
    console.log("Header executed successfully.");

    let body = source.substring(headerEndIndex);

    // Regex to find alias definitions
    const aliasRegex = /var\s+(\w+)=function\([^\)]+\)\{return\s+_0x32e7\(([^,]+),([^\)]+)\);\},?/g;
    let match;
    const aliases = {};

    while ((match = aliasRegex.exec(body)) !== null) {
        const aliasName = match[1];
        const arg1Expr = match[2];
        const arg2Expr = match[3];

        const offsetMatch = arg1Expr.match(/-(-?0x[0-9a-f]+|-?[0-9]+)/);
        let offset = 0;
        if (offsetMatch) {
            offset = parseInt(offsetMatch[1]);
        }

        aliases[aliasName] = {
            offset: offset
        };
    }

    console.log("Aliases found:", Object.keys(aliases).length);

    let replaceCount = 0;

    Object.keys(aliases).forEach(alias => {
        const info = aliases[alias];
        const offset = info.offset;

        const callRegex = new RegExp(`${alias}\\((-?0x[0-9a-f]+|-?[0-9]+),(-?0x[0-9a-f]+|-?[0-9]+),(-?0x[0-9a-f]+|-?[0-9]+),(-?0x[0-9a-f]+|-?[0-9]+)\\)`, 'g');

        body = body.replace(callRegex, (match, a1, a2, a3, a4) => {
            try {
                const index = parseInt(a4);
                const key = parseInt(a2);
                const realIndex = index - offset;

                const result = decoder(realIndex, key);
                replaceCount++;
                return JSON.stringify(result);
            } catch (e) {
                return match;
            }
        });
    });

    console.log(`Replaced ${replaceCount} alias calls.`);

    const outputFile = path.join(__dirname, 'deobfuscated-script-5-v3.js');
    fs.writeFileSync(outputFile, body);
    console.log(`Deobfuscated script saved to ${outputFile}`);

} catch (e) {
    console.error("Error executing header:", e);
    // Save header for inspection
    fs.writeFileSync(path.join(__dirname, 'failed-header.js'), header);
    console.log("Saved failed header to failed-header.js");
}
