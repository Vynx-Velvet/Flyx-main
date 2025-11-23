const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'deobfuscated-script-5-clean.js');
let body = fs.readFileSync(inputFile, 'utf8');

// Remove leading comma
if (body.startsWith(',')) {
    body = body.substring(1);
}
body = body.trim();

// Wrap in parens to make it an expression (valid script if wrapped)
// or assign to variable
const debugContent = 'var debugFunc = ' + body + ';';

const debugFile = path.join(__dirname, 'debug-body.js');
fs.writeFileSync(debugFile, debugContent);

console.log("Written debug-body.js. Run 'node -c scripts/reverse-engineering/debug-body.js' to check syntax.");
