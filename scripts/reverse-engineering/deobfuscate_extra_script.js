const fs = require('fs');
const path = require('path');

const scriptPath = path.join(__dirname, 'extra_script.js');
if (!fs.existsSync(scriptPath)) {
    console.error(`File not found: ${scriptPath}`);
    process.exit(1);
}
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

// Extract the array _0x5292
// It looks like: const _0xded3c2=['...'];_0x5292=function(){return _0xded3c2;};
const arrayRegex = /const\s+_0x[a-f0-9]+\s*=\s*(\['[^\]]+'\]);/;
const arrayMatch = scriptContent.match(arrayRegex);

if (!arrayMatch) {
    console.error("Could not find string array.");
    process.exit(1);
}

// Parse the array
// We need to be careful with quotes. The regex captures ['...'].
// We can try to eval it, but it's safer to use JSON.parse if we replace ' with " and fix escapes.
// Or just eval it in a sandbox.
let stringArray;
try {
    // A simple eval might work if the string is valid JS array literal
    stringArray = eval(arrayMatch[1]);
} catch (e) {
    console.error("Error parsing string array:", e);
    process.exit(1);
}

console.log(`Extracted string array with ${stringArray.length} elements.`);

// Extract the offset from _0x586c
// _0xb6c7eb=_0xb6c7eb-(-0x5f4*-0x5+-0x15db+0x3*-0x202);
// We look for: _0xb6c7eb=_0xb6c7eb-(...);
const offsetRegex = /_0x[a-f0-9]+=_0x[a-f0-9]+-\(([^)]+)\);/;
const offsetMatch = scriptContent.match(offsetRegex);

let offset = 0;
if (offsetMatch) {
    try {
        offset = eval(offsetMatch[1]);
        console.log(`Extracted offset: ${offset}`);
    } catch (e) {
        console.error("Error evaluating offset:", e);
    }
} else {
    console.error("Could not find offset calculation.");
    // Fallback or exit?
}

// Deobfuscation function
// The script also has a rotation logic usually.
// while(!![]){try{const _0x242cea=-parseInt(_0x3e9797(...
// This part rotates the array.
// We need to execute this rotation to get the correct array order.

// Extract the rotation code
// It starts with (function(_0x2fc11d,_0x351383){...}(_0x5292,-0x3308*-0x57+0xb5d*0xb3+-0xee88d));
// We need to extract the second argument to the IIFE, which is the target number.
const iifeRegex = /\(function\(_0x[a-f0-9]+,_0x[a-f0-9]+\)\{.*?\}\(_0x[a-f0-9]+,([^)]+)\)\);/;
const iifeMatch = scriptContent.match(iifeRegex);

let targetNumber = 0;
if (iifeMatch) {
    try {
        targetNumber = eval(iifeMatch[1]);
        console.log(`Extracted rotation target: ${targetNumber}`);
    } catch (e) {
        console.error("Error evaluating rotation target:", e);
    }
} else {
    console.error("Could not find rotation IIFE.");
}

// We need to simulate the rotation.
// The rotation function calls _0x586c (or alias) to get values and compare.
// Since _0x586c depends on the array, and the array is rotated... wait.
// The rotation function uses the array wrapper function.
// We can just run the rotation code if we mock the environment.

// Let's construct a script to run the rotation and then export the deobfuscator.

const vm = require('vm');

const sandbox = {
    window: {},
    document: {},
    console: console
};

// We will construct a script that defines the array, the rotation, and the deobfuscator.
// Then we can use it to deobfuscate strings.

// We need the array definition function name. It was _0x5292 in the file.
// And the deobfuscator function name _0x586c.

// Let's try to extract the whole relevant part: the array, the rotation IIFE, and the _0x586c function.
// They are usually at the beginning or end.
// In extra_script.js, they seem to be at the beginning (based on previous view_file).
// Line 1: (function(_0x2fc11d,_0x351383){...}(_0x5292, ...)); ... function _0x5292(){...} ... function _0x586c...

// Actually, _0x5292 is defined AFTER the IIFE in the code I saw?
// "}(_0x5292,-0x3308*-0x57+0xb5d*0xb3+-0xee88d));const _0x179bad=(function(){...}"
// Wait, _0x5292 is used in the IIFE call, so it must be hoisted or defined before.
// Function declarations are hoisted.

// I'll try to execute the first part of the script in a VM to get the state.
// I'll cut the script after the rotation IIFE and the _0x586c definition.
// But _0x586c might be defined later.

// Let's just copy the array definition and the rotation IIFE and the _0x586c function.
// And the _0x5292 function.

// Regex to find _0x5292 function definition
const func5292Regex = /function _0x5292\(\)\{.*?\};return _0x5292\(\);\}/;
const func5292Match = scriptContent.match(func5292Regex);

// Regex to find _0x586c function definition
const func586cRegex = /function _0x586c\(_0x[a-f0-9]+,_0x[a-f0-9]+\)\{.*?return _0x586c\(_0x[a-f0-9]+,_0x[a-f0-9]+\);\}/;
// The regex for _0x586c might be complex because it contains the offset logic.
// Let's just use the one I saw:
// function _0x586c(_0x230229,_0x5c8a08){const _0x3a8a75=_0x5292();return _0x586c=function(_0xb6c7eb,_0x2ea098){...};return _0x586c(_0x230229,_0x5c8a08);}

// Actually, I can just run the whole script content in a VM, but mock the things that would cause side effects or errors (like window, document).
// And I need to intercept the `_0x586c` function to use it.
// But `_0x586c` is local to the scope? No, it seems to be global or at least accessible.
// Wait, `const _0x179bad=(function(){...`
// The script is wrapped in IIFEs.

// Let's try to extract the strings by regex and deobfuscate them using the logic I reversed.
// Logic:
// 1. Rotate array.
// 2. _0x586c(index, key) -> array[index - offset] -> decode (base64/RC4)

// I need to perform the rotation.
// The rotation IIFE:
/*
(function(_0x2fc11d,_0x351383){
    function _0x3e9797...
    const _0x16b569=_0x2fc11d(); // This gets the array
    while(!![]){
        try{
            const _0x242cea = ... // complex calculation
            if(_0x242cea===_0x351383)break;
            else _0x16b569['push'](_0x16b569['shift']());
        } ...
    }
}(_0x5292, targetNumber));
*/

// I can execute this IIFE if I have _0x5292 defined.
// So I need:
// 1. _0x5292 definition (the array function).
// 2. The IIFE code.

// Let's extract _0x5292 definition.
const arrayFuncStart = scriptContent.indexOf('function _0x5292(){');
const arrayFuncEnd = scriptContent.indexOf('return _0x5292();}', arrayFuncStart) + 'return _0x5292();}'.length;
const arrayFuncCode = scriptContent.substring(arrayFuncStart, arrayFuncEnd);

// Extract IIFE using specific end pattern
const iifeStart = scriptContent.indexOf('(function(_0x2fc11d,_0x351383){');
if (iifeStart === -1) {
    console.error("Could not find IIFE start.");
    process.exit(1);
}

// Look for the end of the IIFE call which involves _0x5292
const iifeEndPattern = '}(_0x5292,';
const iifeEndIndex = scriptContent.indexOf(iifeEndPattern, iifeStart);

if (iifeEndIndex === -1) {
    console.error("Could not find IIFE end pattern.");
    process.exit(1);
}

// Find the closing ); after the arguments
const iifeEnd = scriptContent.indexOf('));', iifeEndIndex) + 3;
const iifeCode = scriptContent.substring(iifeStart, iifeEnd);
console.log("Extracted IIFE code length:", iifeCode.length);

const deobfFuncStart = scriptContent.indexOf('function _0x586c(');

function extractFunctionCode(source, start) {
    let braceCount = 0;
    let end = -1;
    for (let i = start; i < source.length; i++) {
        if (source[i] === '{') braceCount++;
        else if (source[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
                end = i + 1;
                break;
            }
        }
    }
    return source.substring(start, end);
}

// Execute in VM
const ctx = vm.createContext({});
vm.runInContext(arrayFuncCode, ctx);
// Define deobfuscator BEFORE rotation because rotation uses it
const func586cCode = extractFunctionCode(scriptContent, deobfFuncStart);
vm.runInContext(func586cCode, ctx);
vm.runInContext(iifeCode, ctx);

// Now the array inside _0x5292 (closure) should be rotated.
// But wait, _0x5292 returns `_0xded3c2`. The IIFE calls `_0x5292()` to get the array reference `_0x16b569`.
// Then it modifies `_0x16b569` (push/shift).
// Since `_0xded3c2` is a const in `_0x5292`, wait.
// `const _0xded3c2=['...'];_0x5292=function(){return _0xded3c2;};`
// If `_0xded3c2` is defined INSIDE `_0x5292` (the outer one), then calling `_0x5292()` returns the array.
// Modifying it works because it's a reference.
// So after running the IIFE, the array `_0xded3c2` inside the closure is rotated.
// Subsequent calls to `_0x5292()` will return the rotated array.

// Now I need `_0x586c`.
// It is defined as:
// function _0x586c(_0x230229,_0x5c8a08){const _0x3a8a75=_0x5292();return _0x586c=function(_0xb6c7eb,_0x2ea098){...
// I can just extract this function and run it.
// But it relies on `_0x5292` which is already in the context.


console.log("Extracted _0x586c code length:", func586cCode.length);
console.log("Start of _0x586c:", func586cCode.substring(0, 100));

// Save the context setup to a file so I can use it later.
const outputScript = `
const vm = require('vm');

const arrayFuncCode = ${JSON.stringify(arrayFuncCode)};
const iifeCode = ${JSON.stringify(iifeCode)};
const func586cCode = ${JSON.stringify(func586cCode)};

const ctx = vm.createContext({
    window: {},
    document: {},
    atob: (str) => Buffer.from(str, 'base64').toString('binary'),
    console: console
});

console.log("Initializing VM...");
vm.runInContext(arrayFuncCode, ctx);
console.log("Defining deobfuscator...");
vm.runInContext(func586cCode, ctx);
console.log("Running rotation...");
vm.runInContext(iifeCode, ctx);

function decode(index, key) {
    return vm.runInContext(\`_0x586c(\${index}, '\${key}')\`, ctx);
}

module.exports = { decode };

// Test
if (require.main === module) {
    try {
        console.log("Test 784, VV0q:", decode(784, 'VV0q'));
    } catch (e) {
        console.error(e);
    }
}
`;

fs.writeFileSync(path.join(__dirname, 'deobfuscate_extra_script_vm.js'), outputScript);
console.log("Created deobfuscate_extra_script_vm.js");

// Skip running VM here to avoid hang
// vm.runInContext(func586cCode, ctx);
// I need to know what to test.
// The user wants to replicate the logic.
// I can export a function `deobfuscate(index, key)` that calls `_0x586c(index, key)` in the VM.

// But `_0x586c` takes 2 args.
// Let's try to deobfuscate some strings found in the script.
// e.g. `_0x586c(_0x542aff-0x2f9,_0x4e3adb)` in the IIFE.
// `0x609` -> `1545`. `0x2f9` -> `761`. `1545-761` = `784`.
// `_0x586c(784, 'VV0q')`.

try {
    const result = vm.runInContext("_0x586c(784, 'VV0q')", ctx);
    console.log(`Test deobfuscation result: ${result}`);
} catch (e) {
    console.error("Error running deobfuscation in VM:", e);
}

// Save the context setup to a file so I can use it later.
// I'll write a script that sets up this environment and exports a decode function.

