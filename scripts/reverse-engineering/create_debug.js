const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'extra_script_new.js');
const outputPath = path.join(__dirname, 'test_isolation.js');

const content = fs.readFileSync(inputPath, 'utf8');

// 1. Extract the Shuffling IIFE
const iifeEndMarker = "const _0x179bad";
const iifeEndIndex = content.indexOf(iifeEndMarker);
if (iifeEndIndex === -1) {
    console.error("Could not find IIFE end marker");
    process.exit(1);
}
let iifeCode = content.substring(0, iifeEndIndex).trim();

// 2. Extract _0x5292 (The Array)
const arrayStartMarker = "function _0x5292() {";
const arrayStartIndex = content.indexOf(arrayStartMarker);
if (arrayStartIndex === -1) {
    console.error("Could not find _0x5292 start");
    process.exit(1);
}
const arrayEndMarker = "return _0x5292(); }";
const arrayEndIndex = content.indexOf(arrayEndMarker, arrayStartIndex);
if (arrayEndIndex === -1) {
    console.error("Could not find _0x5292 end");
    process.exit(1);
}
const arrayCode = content.substring(arrayStartIndex, arrayEndIndex + arrayEndMarker.length);

// 3. Extract _0x586c (The Accessor)
const accessorStartMarker = "function _0x586c(_0x230229, _0x5c8a08) {";
const accessorStartIndex = content.indexOf(accessorStartMarker);
if (accessorStartIndex === -1) {
    console.error("Could not find _0x586c start");
    process.exit(1);
}
const accessorEndMarker = "_0x586c(_0x230229, _0x5c8a08); }";
const accessorEndIndex = content.indexOf(accessorEndMarker, accessorStartIndex);
if (accessorEndIndex === -1) {
    console.error("Could not find _0x586c end");
    process.exit(1);
}
const accessorCode = content.substring(accessorStartIndex, accessorEndIndex + accessorEndMarker.length);

// Inject logs into Accessor
let modifiedAccessorCode = accessorCode.replace(
    "function _0x586c(_0x230229, _0x5c8a08) {",
    "function _0x586c(_0x230229, _0x5c8a08) { console.log('Called _0x586c', _0x230229, _0x5c8a08);"
);

modifiedAccessorCode = modifiedAccessorCode.replace(
    "var _0x1b2387 = function (_0x122463) {",
    "var _0x1b2387 = function (_0x122463) { console.log('Base64 decode input:', _0x122463);"
);

modifiedAccessorCode = modifiedAccessorCode.replace(
    "return decodeURIComponent(_0x5cf61a);",
    "console.log('Decoding URI component, length:', _0x5cf61a.length); return decodeURIComponent(_0x5cf61a);"
);

modifiedAccessorCode = modifiedAccessorCode.replace(
    "if (_0x586c['SmDTIU'] === undefined) {",
    "if (false) { /* Anti-tamper disabled */"
);

const debugContent = `
// Test Isolation Script

// 1. The Array
${arrayCode}

// 2. The Accessor
${modifiedAccessorCode}

console.log("Testing _0x586c(784, 'VV0q')...");

// Also check the array index
const offset = 784 - (-0x5f4 * -0x5 + -0x15db + 0x3 * -0x202);
console.log("Calculated offset:", offset);
const arr = _0x5292();
console.log("Array length:", arr.length);
console.log("Item at offset:", arr[offset]);

try {
    const result = _0x586c(784, 'VV0q');
    console.log("Result:", result);
} catch (e) {
    console.error("Error:", e);
}

`;

fs.writeFileSync(outputPath, debugContent);
console.log("Created test_isolation.js");
