const fs = require('fs');
const path = require('path');
const vm = require('vm');

const inputFile = path.join(__dirname, 'extracted-script-5.js');
let source = fs.readFileSync(inputFile, 'utf8');

if (source.charCodeAt(0) === 0xFEFF) {
    source = source.slice(1);
}

// --- Extract Header ---
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

const header = `
${arrayDef}
${decoderDef}
(function(_0x237545,_0x514957){
    ${shuffleBody}
}(_0x5bd0, ${targetExpr}));
global.decoder = _0x32e7;
`;
// ----------------------

// --- Prepare Body ---
const bodyFile = path.join(__dirname, 'deobfuscated-script-5-fixed.js');
let body = fs.readFileSync(bodyFile, 'utf8');

// Mock environment
const sandbox = {
    window: {},
    document: {
        createElement: () => ({}),
        getElementById: () => ({}),
    },
    navigator: {
        userAgent: 'Mozilla/5.0',
    },
    location: {
        href: 'http://localhost',
        search: '',
    },
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    String: String,
    Function: Function,
    Array: Array,
    Object: Object,
    Date: Date,
    Math: Math,
    parseInt: parseInt,
    parseFloat: parseFloat,
    JSON: JSON,
    RegExp: RegExp,
    Error: Error,
    btoa: (s) => Buffer.from(s).toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('utf8'),
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.global = sandbox;

// Construct the full script
const inspectionCode = `
    console.log("Inspection point reached.");
    
    // Check _0x54904b
    if (typeof _0x54904b !== 'undefined') {
        console.log("_0x54904b type:", typeof _0x54904b);
        if (Array.isArray(_0x54904b)) {
            console.log("_0x54904b length:", _0x54904b.length);
            console.log("_0x54904b content:", JSON.stringify(_0x54904b, null, 2));
        } else {
            console.log("_0x54904b value:", _0x54904b);
        }
    } else {
        console.log("_0x54904b is undefined.");
    }
    
    // Check _0x22f029 (main object)
    if (typeof _0x22f029 !== 'undefined') {
        console.log("_0x22f029 keys:", Object.keys(_0x22f029));
        if (_0x22f029["nrYcg"]) {
             console.log("_0x22f029['nrYcg']:", _0x22f029["nrYcg"]);
        }
    }
`;

// Find insertion point
const searchStr = 'var _0x54904b=';
const idx = body.indexOf(searchStr);
if (idx !== -1) {
    const semiIdx = body.indexOf(';', idx);
    if (semiIdx !== -1) {
        const insertPoint = semiIdx + 1;
        body = body.substring(0, insertPoint) + inspectionCode + body.substring(insertPoint);
        console.log("Inserted inspection code at index", insertPoint);
    } else {
        console.log("Semicolon not found after variable definition.");
    }
} else {
    console.log("Variable definition not found.");
}

console.log("Executing (body)() with fixed script...");
try {
    vm.createContext(sandbox);
    vm.runInContext(header + '\n' + '(' + body + ')()', sandbox);
    console.log("Success!");
} catch (e) {
    console.log("Failed: " + e.message);
}
