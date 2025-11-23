const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'extracted-script-5.js');
let source = fs.readFileSync(inputFile, 'utf8');

if (source.charCodeAt(0) === 0xFEFF) {
    source = source.slice(1);
}

const startString = 'pe.d-e%\\x20av';
const startIndex = source.indexOf(startString);

if (startIndex === -1) {
    console.error("Start string not found");
    process.exit(1);
}

// Read 500 chars starting from startIndex
const chunk = source.substring(startIndex, startIndex + 500);
console.log("--- CHUNK START ---");
console.log(chunk);
console.log("--- CHUNK END ---");

// Read 500 chars ending at the expected end
const endString = "'-o'";
const endIndex = source.indexOf(endString, startIndex);
if (endIndex !== -1) {
    const endChunk = source.substring(endIndex - 100, endIndex + 20);
    console.log("--- CHUNK END AREA ---");
    console.log(endChunk);
    console.log("--- CHUNK END AREA END ---");
}
