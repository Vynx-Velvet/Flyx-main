const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'extracted-script-5.js');
let source = fs.readFileSync(inputFile, 'utf8');

const splitString = '),function(){';
const splitIndex = source.indexOf(splitString);
const headerEndIndex = splitIndex + 1;
let header = source.substring(0, headerEndIndex);

// Replace anti-tamper
header = header.replace(/new _0x556ec0\(_0x32e7\)\['ahGfRn'\]\(\)/g, 'null');

// Format for debugging
let formatted = header
    .replace(/;/g, ';\n')
    .replace(/{/g, '{\n')
    .replace(/}/g, '}\n');

formatted += ';\n';

const debugFile = path.join(__dirname, 'debug-header-5.js');
fs.writeFileSync(debugFile, formatted);

console.log("Written debug-header-5.js");
