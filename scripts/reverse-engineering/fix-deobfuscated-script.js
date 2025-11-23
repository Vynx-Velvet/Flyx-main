const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'deobfuscated-script-5-clean.js');
let body = fs.readFileSync(inputFile, 'utf8');

// Remove leading comma
if (body.startsWith(',')) {
    body = body.substring(1);
}
body = body.trim();

// Fix the bad string
const badString = '"^([^ ]+( +"+"[^ ]+)+)+["+"^ ]}';
if (body.includes(badString)) {
    console.log("Found bad string, replacing...");
    body = body.replace(badString, '"REGEX_PLACEHOLDER"');
}

// Fix brace balance: remove the extra '}' at the end
if (body.endsWith('}')) {
    body = body.substring(0, body.length - 1);
}

// Write fixed body to file
const outputFile = path.join(__dirname, 'deobfuscated-script-5-fixed.js');
fs.writeFileSync(outputFile, body);
console.log("Fixed body written to " + outputFile);
