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

// Remove leading comma
if (body.startsWith(',')) {
    body = body.substring(1);
}
body = body.trim();

// Extract _0x368952
const funcStart = body.indexOf('function _0x368952');
if (funcStart !== -1) {
    let braceCount = 0;
    let funcEnd = -1;
    for (let i = funcStart; i < body.length; i++) {
        if (body[i] === '{') braceCount++;
        else if (body[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
                funcEnd = i + 1;
                break;
            }
        }
    }

    if (funcEnd !== -1) {
        let funcDef = body.substring(funcStart, funcEnd);

        // Remove the problematic IIFE: function(){var _0x31ea35=...}();
        const iifeStartMarker = '(_0x13b9ec),function(){';
        const iifeStart = funcDef.indexOf(iifeStartMarker);

        if (iifeStart !== -1) {
            const startOfComma = iifeStart + '(_0x13b9ec)'.length;

            let iifeBraceCount = 0;
            let iifeEnd = -1;
            for (let i = startOfComma + 1; i < funcDef.length; i++) {
                if (funcDef[i] === '{') iifeBraceCount++;
                else if (funcDef[i] === '}') {
                    iifeBraceCount--;
                    if (iifeBraceCount === 0) {
                        if (funcDef.substring(i + 1, i + 4) === '();') {
                            iifeEnd = i + 4;
                        } else if (funcDef.substring(i + 1, i + 3) === '()') {
                            iifeEnd = i + 3;
                        }
                        break;
                    }
                }
            }

            if (iifeEnd !== -1) {
                console.log("Found IIFE to remove.");
                console.log("Context before: " + funcDef.substring(startOfComma - 20, startOfComma));
                console.log("Removed part start: " + funcDef.substring(startOfComma, startOfComma + 50));
                console.log("Removed part end: " + funcDef.substring(iifeEnd - 20, iifeEnd));
                console.log("Context after: " + funcDef.substring(iifeEnd, iifeEnd + 20));

                // Perform replacement
                const newFuncDef = funcDef.substring(0, startOfComma) + funcDef.substring(iifeEnd);
                console.log("New context: " + newFuncDef.substring(startOfComma - 20, startOfComma + 20));
            } else {
                console.log("Could not find end of IIFE");
            }
        } else {
            console.log("Could not find start of IIFE marker");
        }
    }
}
