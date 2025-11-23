const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'extra_script_new.js');
const outputPath = path.join(__dirname, 'extra_script_patched.js');

let content = fs.readFileSync(inputPath, 'utf8');

// Disable anti-tamper check
// The check is: if (_0x586c['SmDTIU'] === undefined) {
// We replace it with: if (false) { /* Anti-tamper disabled */
const searchString = "if(_0x586c['SmDTIU']===undefined){";
const replacementString = "if(false){/* Anti-tamper disabled */";

// Note: The file might be minified, so spaces might be missing.
// Let's try to find the string with flexible spacing if exact match fails.
// But based on previous steps, it seems to be minified.

if (content.includes(searchString)) {
    content = content.replace(searchString, replacementString);
    console.log("Patched anti-tamper check (exact match).");
} else {
    // Try with spaces just in case
    const searchStringSpaces = "if (_0x586c['SmDTIU'] === undefined) {";
    if (content.includes(searchStringSpaces)) {
        content = content.replace(searchStringSpaces, "if (false) { /* Anti-tamper disabled */");
        console.log("Patched anti-tamper check (spaced match).");
    } else {
        console.error("Could not find anti-tamper check to patch!");
        // Try a regex approach if simple string replacement fails
        // Looking for: if(_0x586c['SmDTIU']===undefined)
        const regex = /if\s*\(_0x586c\['SmDTIU'\]\s*===\s*undefined\)\s*\{/;
        if (regex.test(content)) {
            content = content.replace(regex, "if(false){/* Anti-tamper disabled */");
            console.log("Patched anti-tamper check (regex match).");
        } else {
            console.error("Regex match failed too.");
            process.exit(1);
        }
    }
}

// Inject logging into the shuffling loop to debug NaN
// Search for the start of the try block in the loop
// try { const _0x242cea = ...
const tryBlockStart = "try{const _0x242cea=";
const logInjection = `
try {
    const v1 = -parseInt(_0x3e9797(0x609, 0x4f6, 0x5ca, 'VV0q', 0x620));
    const v2 = parseInt(_0x51b22a(0x7fb, 0x76c, '3ke&', 0x6d2, 0x6f0));
    const v3 = parseInt(_0x3471d2(0x421, 0x62e, 0x4b5, 'vTlU', 0x62b));
    const v4 = parseInt(_0x51b22a(0x9ba, 0x84c, 'di*4', 0x83c, 0x8c2));
    const v5 = parseInt(_0x3e9797(0x6b2, 0x6a3, 0x62b, ']tN^', 0x67a));
    const v6 = -parseInt(_0x3e9797(0x567, 0x5b1, 0x5aa, 'V!S(', 0x52c));
    const v7 = parseInt(_0x3471d2(0x6bb, 0x6e6, 0x5b9, 'p#uc', 0x725));
    const v8 = parseInt(_0x3471d2(0x559, 0x434, 0x4cd, 'D!DA', 0x40e));
    console.log('Debug components:', v1, v2, v3, v4, v5, v6, v7, v8);
    const _0x242cea = v1 / (-0x1 * 0x1979 + -0x1b29 + 0x34a3) + v2 / (-0x2 * -0x5db + -0x51e + -0x696) * (v3 / (-0x58 * -0x6d + 0x286 + -0x27fb)) + v4 / (0x65 * 0x30 + -0x170e + 0x1 * 0x422) + v5 / (0x3a9 * 0x1 + -0x4ab * 0x1 + 0x1 * 0x107) + v6 / (0x26 * 0xbb + -0x1f24 + 0xda * 0x4) + v7 / (-0x9b2 + -0x4a * -0x11 + 0x4cf * 0x1) + v8 / (0x103 * -0x22 + -0x1bfa + 0x3e68);
`;

if (content.includes(tryBlockStart)) {
    content = content.replace(tryBlockStart, logInjection);
    console.log("Injected debug logs into shuffling loop.");
} else {
    // Try with spaces
    const tryBlockStartSpaces = "try { const _0x242cea =";
    if (content.includes(tryBlockStartSpaces)) {
        content = content.replace(tryBlockStartSpaces, logInjection);
        console.log("Injected debug logs into shuffling loop (spaced).");
    } else {
        console.error("Could not find shuffling loop to inject logs!");
        // Regex fallback
        const regexLoop = /try\s*\{\s*const\s+_0x242cea\s*=/;
        if (regexLoop.test(content)) {
            content = content.replace(regexLoop, "try{console.log('Debug val:',_0x3e9797(0x609,0x4f6,0x5ca,'VV0q',0x620));const _0x242cea=");
            console.log("Injected debug logs into shuffling loop (regex).");
        }
    }
}

fs.writeFileSync(outputPath, content);
console.log("Created extra_script_patched.js");
