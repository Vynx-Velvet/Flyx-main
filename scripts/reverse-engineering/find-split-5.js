const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'extracted-script-5.js');
const source = fs.readFileSync(inputFile, 'utf8');

const splitString = '}(_0x5bd0,';
const splitIndex = source.indexOf(splitString);

if (splitIndex !== -1) {
    console.log(`Found split string at index ${splitIndex}`);
    console.log('Context:');
    console.log(source.substring(splitIndex - 50, splitIndex + 100));
} else {
    console.log('Split string not found.');
}
