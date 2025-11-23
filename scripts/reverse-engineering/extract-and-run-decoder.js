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

// --- Prepare Body ---
const bodyFile = path.join(__dirname, 'deobfuscated-script-5-fixed.js');
let body = fs.readFileSync(bodyFile, 'utf8');
if (body.startsWith(',')) body = body.substring(1);
body = body.trim();

// Helper to extract function by name with string support
function extractFunction(source, funcName) {
    const startStr = `function ${funcName}`;
    const start = source.indexOf(startStr);
    if (start === -1) return null;

    let braceCount = 0;
    let end = -1;
    let foundBrace = false;
    let inString = false;
    let stringChar = '';

    for (let i = start; i < source.length; i++) {
        const char = source[i];

        if (inString) {
            if (char === stringChar && source[i - 1] !== '\\') {
                inString = false;
            }
            continue;
        }

        if (char === '"' || char === "'") {
            inString = true;
            stringChar = char;
            continue;
        }

        if (char === '{') {
            braceCount++;
            foundBrace = true;
        } else if (char === '}') {
            braceCount--;
            if (foundBrace && braceCount === 0) {
                end = i + 1;
                break;
            }
        }
    }

    if (end !== -1) {
        return source.substring(start, end);
    }
    return null;
}

// Extract top vars and object
let topVars = body.substring(0, body.indexOf(',_0x135a29={'));
if (topVars.startsWith('function(){')) topVars = topVars.substring(11);

const objStart = body.indexOf(',_0x135a29={');
const objEnd = body.indexOf('var _0x22f029=_0x135a29');
let objDef = '';
if (objStart !== -1 && objEnd !== -1) {
    objDef = body.substring(objStart, objEnd);
    if (objDef.startsWith(',')) objDef = 'var ' + objDef.substring(1);
}
const badString = '"^([^ ]+( +"+"[^ ]+)+)+["+"^ ]}';
if (objDef.includes(badString)) {
    objDef = objDef.replace(badString, '"REGEX_PLACEHOLDER"');
}

// Functions to extract
const funcsToExtract = [
    '_0x3d5c48', '_0x31d499', '_0x199187', '_0x44b0b9', '_0x2df43f',
    '_0x23cd7b', '_0x368952', '_0x3c3f93', '_0x3a55d6', '_0x797095',
    '_0x3ed68e', '_0x14b603'
];

let extractedFuncs = '';
for (const funcName of funcsToExtract) {
    const code = extractFunction(body, funcName);
    if (code) {
        extractedFuncs += code + '\n';
    } else {
        console.log(`Warning: Function ${funcName} not found`);
    }
}

// Fix IIFE in _0x368952
const iifeStartMarker = ',function(){var _0x31ea35=';
if (extractedFuncs.includes(iifeStartMarker)) {
    extractedFuncs = extractedFuncs.replace(iifeStartMarker, ',function(){return;var _0x31ea35=');
}

// Mock environment
const sandbox = {
    window: {},
    document: { createElement: () => ({}), getElementById: () => ({}) },
    navigator: { userAgent: 'Mozilla/5.0' },
    location: { href: 'http://localhost', search: '' },
    console: { log: () => { }, warn: () => { }, error: () => { }, info: () => { }, table: () => { }, trace: () => { } },
    setTimeout: setTimeout, clearTimeout: clearTimeout,
    setInterval: setInterval, clearInterval: clearInterval,
    String: String, Function: Function, Array: Array, Object: Object,
    Date: Date, Math: Math, parseInt: parseInt, parseFloat: parseFloat,
    JSON: JSON, RegExp: RegExp, Error: Error,
    btoa: (s) => Buffer.from(s).toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('utf8'),
    printResult: console.log,
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.global = sandbox;

const nrYcgVal = "'pe.d-e%\\x20av'+\"i-lenw%mi#\"+\"%%ioettayX\"+'-%awea..rn'+'lxsscr%g%%'+'--%panb%on'+\"lke%%ciltl\"+\"%-Caau.l-0\"+'tbtmyoaiin'+\"tug-btuiy%\"+\"hElsYilhfX\"+\"%-nPro-O.a\"+\"tb-rt%nn.%\"+'hal-sp-%-a'+\"tes-0gak%-\"+\"tsis%%utrf\"+\"%xt-mfcelb\"+\"k-u5-ie-l0\"+'0etac-u%gP'+\"npoe-e.pbo\"+'ns%vptwltV'+\"ekcc-u%P%d\"+\"%teedcom-c\"+\"o%awil0cQ-\"+\"etsa%-cdpr\"+'-o'";
const numArg = -0x3146e + -0x7ce3f + 0x169b0 * 0xb;

const prototypeMocks = `
    Object.prototype.tmErB = function() { return false; };
    Object.prototype.pabur = function() { return ""; };
    Object.prototype.OlXem = "";
    Object.prototype.dzgXS = "";
    Object.prototype.tgDvl = function() {};
    Object.prototype.eYKPi = "";
`;

const extractionScript = `
    ${header}
    ${prototypeMocks}
    ${topVars};
    ${objDef};
    var _0x22f029 = _0x135a29;
    
    // Mocks
    var _0x599da4 = function() { return function() {}; };
    var _0x4ef584 = function() { return function() {}; };
    var _0x3b8f84 = function() { return function() {}; };
    var _0xad4dfd = function() {};
    var _0x54904b = null;
    
    ${extractedFuncs}
    
    printResult("Testing _0x3d5c48:");
    try {
        // _0x3d5c48 might return a function or be the function
        // In extracted-funcs.js: function _0x3d5c48(){...}
        // It returns btoa or executes logic.
        // Wait, _0x3d5c48() returns btoa?
        // Let's check the return value of calling it.
        var encoder = _0x3d5c48();
        printResult("Type of _0x3d5c48(): " + typeof encoder);
        if (typeof encoder === 'function') {
            printResult("Encoding 'test': " + encoder("test"));
        } else {
            printResult("_0x3d5c48 is not returning a function?");
        }
    } catch (e) {
        printResult("Error testing _0x3d5c48: " + e.message);
        printResult(e.stack);
    }
`;

try {
    vm.createContext(sandbox);
    vm.runInContext(extractionScript, sandbox);
} catch (e) {
    console.error("Extraction error:", e);
}
