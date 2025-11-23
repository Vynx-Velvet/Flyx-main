const fs = require('fs');
const path = require('path');
const vm = require('vm');

const inputFile = path.join(__dirname, 'extracted-script-5.js');
let source = fs.readFileSync(inputFile, 'utf8');

if (source.charCodeAt(0) === 0xFEFF) {
    source = source.slice(1);
}

// 1. Extract Array
const arrayRegex = /var _0x5bd0=\[.*?\];/;
const arrayMatch = source.match(arrayRegex);
if (!arrayMatch) throw new Error("Array not found");
const arrayDef = arrayMatch[0];

// 2. Extract Decoder
// var _0x32e7=function... return _0x38c803;};
// It ends before the IIFE (function...
const decoderRegex = /var _0x32e7=function[\s\S]*?return _0x38c803;};/;
const decoderMatch = source.match(decoderRegex);
if (!decoderMatch) throw new Error("Decoder not found");
let decoderDef = decoderMatch[0];

// Remove anti-tamper from decoder
decoderDef = decoderDef.replace(/new _0x556ec0\(_0x32e7\)\['ahGfRn'\]\(\)/g, 'null');

// 3. Extract Shuffle Target
// The IIFE call is at the end of the header.
// }(_0x5bd0, TARGET));
const targetRegex = /}\(_0x5bd0,([^)]+)\)/;
const targetMatch = source.match(targetRegex);
if (!targetMatch) throw new Error("Shuffle target not found");
const targetExpr = targetMatch[1];

// 4. Extract Shuffle Body
// (function(_0x237545,_0x514957){ BODY }(_0x5bd0
const shuffleRegex = /\(function\(_0x237545,_0x514957\)\{([\s\S]*?)\}\(_0x5bd0/;
const shuffleMatch = source.match(shuffleRegex);
if (!shuffleMatch) throw new Error("Shuffle body not found");
const shuffleBody = shuffleMatch[1];

// Reconstruct Header
const cleanHeader = `
${arrayDef}
${decoderDef}
(function(_0x237545,_0x514957){
    ${shuffleBody}
}(_0x5bd0, ${targetExpr}));
global.decoder = _0x32e7;
`;

console.log("Clean header constructed.");

// Execute
const sandbox = { global: {} };
vm.createContext(sandbox);
vm.runInContext(cleanHeader, sandbox);

const decoder = sandbox.global.decoder;
console.log("Decoder obtained.");

// Test decoder
// console.log("Test decode 0:", decoder(0, 0)); // Removed to avoid crash on invalid index

// Deobfuscate Body
const splitString = '),function(){';
const splitIndex = source.indexOf(splitString);
const headerEndIndex = splitIndex + 1;
let body = source.substring(headerEndIndex);

// Regex to find alias definitions. They can be 'var name=...' or ',name=...'
// We just look for 'name=function...{return _0x32e7(...)}'
const aliasRegex = /(_0x[a-f0-9]+)=function\([^\)]+\)\{return\s+_0x32e7\(([^,]+),([^\)]+)\);}/g;
let match;
const aliases = {};

while ((match = aliasRegex.exec(body)) !== null) {
    const aliasName = match[1];
    const arg1Expr = match[2];
    const offsetMatch = arg1Expr.match(/-(-?0x[0-9a-f]+|-?[0-9]+)/);
    let offset = 0;
    if (offsetMatch) {
        offset = parseInt(offsetMatch[1]);
    }
    aliases[aliasName] = { offset: offset };
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

const outputFile = path.join(__dirname, 'deobfuscated-script-5-clean.js');
fs.writeFileSync(outputFile, body);
console.log(`Deobfuscated script saved to ${outputFile}`);
