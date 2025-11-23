const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'extracted-script-5.js');
let source = fs.readFileSync(inputFile, 'utf8');

if (source.charCodeAt(0) === 0xFEFF) {
    source = source.slice(1);
}

console.log("Last 50 chars:");
console.log(source.slice(-50));
