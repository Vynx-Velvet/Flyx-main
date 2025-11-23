const fs = require('fs');
const path = require('path');
const vm = require('vm');

const inputFile = path.join(__dirname, 'extracted-script-5.js');
let source = fs.readFileSync(inputFile, 'utf8');

if (source.charCodeAt(0) === 0xFEFF) {
    source = source.slice(1);
}

// --- Construct Clean Header ---
const arrayRegex = /var _0x5bd0=\[.*?\];/;
const arrayMatch = source.match(arrayRegex);
if (!arrayMatch) throw new Error("Array not found");
const arrayDef = arrayMatch[0];

const decoderRegex = /var _0x32e7=function[\s\S]*?return _0x38c803;};/;
const decoderMatch = source.match(decoderRegex);
if (!decoderMatch) throw new Error("Decoder not found");
let decoderDef = decoderMatch[0];
decoderDef = decoderDef.replace(/new _0x556ec0\(_0x32e7\)\['ahGfRn'\]\(\)/g, 'null');

const targetRegex = /}\(_0x5bd0,([^)]+)\)/;
const targetMatch = source.match(targetRegex);
if (!targetMatch) throw new Error("Shuffle target not found");
const targetExpr = targetMatch[1];

const shuffleRegex = /\(function\(_0x237545,_0x514957\)\{([\s\S]*?)\}\(_0x5bd0/;
const shuffleMatch = source.match(shuffleRegex);
if (!shuffleMatch) throw new Error("Shuffle body not found");
const shuffleBody = shuffleMatch[1];

const cleanHeader = `
${arrayDef}
${decoderDef}
(function(_0x237545,_0x514957){
    ${shuffleBody}
}(_0x5bd0, ${targetExpr}));
global.decoder = _0x32e7;
`;
// ------------------------------

const sandbox = { global: {} };
vm.createContext(sandbox);
vm.runInContext(cleanHeader, sandbox);
const decoder = sandbox.global.decoder;

// Extract string and aliases logic
const startString = 'pe.d-e%\\x20av';
const endString = "'-o'";
let startIndex = source.indexOf(startString);
const endIndex = source.indexOf(endString, startIndex);

if (startIndex === -1 || endIndex === -1) {
    console.error("Could not find the string.");
    process.exit(1);
}

// Adjust startIndex to include the opening quote
startIndex = startIndex - 1;

// Find aliases in the body (after header)
const splitString = '),function(){';
const splitIndex = source.indexOf(splitString);
const headerEndIndex = splitIndex + 1;
let body = source.substring(headerEndIndex);

const aliasRegex = /var\s+(_0x[a-f0-9]+)=function\([^\)]+\)\{return\s+_0x32e7\(([^,]+),([^\)]+)\);\},(_0x[a-f0-9]+)=function\([^\)]+\)\{return\s+_0x32e7\(([^,]+),([^\)]+)\);\},/;
const match = body.match(aliasRegex);

if (match) {
    const alias1 = match[1];
    const expr1 = match[2];
    const alias2 = match[4];
    const expr2 = match[5];

    console.log(`Found aliases: ${alias1}, ${alias2}`);

    const createAlias = (expr) => {
        const offsetMatch = expr.match(/-(-?0x[0-9a-f]+|-?[0-9]+)/);
        const offset = offsetMatch ? parseInt(offsetMatch[1]) : 0;
        return (a, b, c, d) => decoder(d - offset, b);
    };

    sandbox[alias1] = createAlias(expr1);
    sandbox[alias2] = createAlias(expr2);

    // Extract string expression from source (using original indices)
    let stringExpr = source.substring(startIndex, endIndex + 4);
    stringExpr = stringExpr.replace(/[\r\n]/g, '');

    console.log("String Expression Length:", stringExpr.length);
    console.log("Last 20 chars codes:");
    for (let i = stringExpr.length - 20; i < stringExpr.length; i++) {
        console.log(`${i}: ${stringExpr[i]} (${stringExpr.charCodeAt(i)})`);
    }

    console.log("Evaluating string expression...");
    const result = vm.runInContext(stringExpr, sandbox);

    console.log("\n=== DECODED STRING ===\n");
    console.log(result);

    const reversedRaw = result.split('').reverse().join('');
    console.log("\n=== REVERSED RAW ===\n");
    console.log(reversedRaw);

    // Decode Property Name
    // _0x5288ab(0x256,0x2ac,0x2e9,0x2d9)
    // We need to find the alias that corresponds to _0x5288ab.
    // In the previous run, it found aliases: _0x5725c2, _0x5288ab
    // We don't know which one is which in the sandbox (alias1 vs alias2).
    // But we can try both or check the source.
    // The source has:
    // _0x5725c2=function...
    // _0x5288ab=function...
    // So alias2 is _0x5288ab.

    console.log("\n=== DECODING PROPERTY NAME ===\n");
    try {
        const propName = sandbox[alias2](0x256, 0x2ac, 0x2e9, 0x2d9);
        console.log("Property Name:", propName);
    } catch (e) {
        console.log("Error decoding property name:", e);
    }

} else {
    console.error("Could not find alias definitions.");
}
