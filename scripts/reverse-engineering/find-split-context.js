const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'extracted-script-5.js');
let source = fs.readFileSync(inputFile, 'utf8');

if (source.charCodeAt(0) === 0xFEFF) {
    source = source.slice(1);
}

const splitString = '),function(){';
const splitIndex = source.indexOf(splitString);

if (splitIndex !== -1) {
    console.log(`Split found at ${splitIndex}`);
    console.log(source.substring(splitIndex - 50, splitIndex + 50));
} else {
    console.log("Split string not found");
}
