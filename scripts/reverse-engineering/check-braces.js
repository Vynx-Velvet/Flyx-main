const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'deobfuscated-script-5-clean.js');
let body = fs.readFileSync(inputFile, 'utf8');

// Remove leading comma
if (body.startsWith(',')) {
    body = body.substring(1);
}
body = body.trim();

console.log("Body start:", body.substring(0, 50));
console.log("Body end:", body.substring(body.length - 50));

// Check for balanced braces
let braceCount = 0;
for (let i = 0; i < body.length; i++) {
    if (body[i] === '{') braceCount++;
    else if (body[i] === '}') braceCount--;
}
console.log("Brace balance:", braceCount);
