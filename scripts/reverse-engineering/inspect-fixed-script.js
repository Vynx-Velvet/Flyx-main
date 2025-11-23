const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'deobfuscated-script-5-fixed.js');
const source = fs.readFileSync(inputFile, 'utf8');

// Find the string that caused the error
const searchString = 'nrYcg';
let index = source.indexOf(searchString);

console.log(`Searching for "${searchString}" in ${inputFile}...`);

while (index !== -1) {
    console.log(`\nFound at index ${index}:`);
    const start = Math.max(0, index - 100);
    const end = Math.min(source.length, index + 500);
    console.log(source.substring(start, end));

    index = source.indexOf(searchString, index + 1);
}
