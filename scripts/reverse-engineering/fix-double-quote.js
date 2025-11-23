const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'deobfuscated-script-5-fixed.js');
let body = fs.readFileSync(inputFile, 'utf8');

// Fix the double quote issue
// Look for "REGEX_PLACEHOLDER""
if (body.includes('"REGEX_PLACEHOLDER""')) {
    console.log("Found double quote error, fixing...");
    body = body.replace('"REGEX_PLACEHOLDER""', '"REGEX_PLACEHOLDER"');
}

fs.writeFileSync(inputFile, body);
console.log("Fixed double quote in " + inputFile);
