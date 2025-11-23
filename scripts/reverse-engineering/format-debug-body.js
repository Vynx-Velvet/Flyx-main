const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'debug-body.js');
let source = fs.readFileSync(inputFile, 'utf8');

// Simple formatting
source = source.replace(/;/g, ';\n').replace(/{/g, '{\n').replace(/}/g, '}\n');

const outputFile = path.join(__dirname, 'debug-body-formatted.js');
fs.writeFileSync(outputFile, source);

console.log("Formatted debug body saved to " + outputFile);
