const fs = require('fs');
const path = require('path');

const decodedStrings = JSON.parse(fs.readFileSync(path.join(__dirname, 'decoded-strings.json'), 'utf8'));
const sourceFile = path.join(__dirname, 'extracted-funcs.js');
let source = fs.readFileSync(sourceFile, 'utf8');

// Function to evaluate simple math expressions found in the script
function evalMath(expr) {
    try {
        // Safety check: only allow numbers, operators, and whitespace
        if (!/^[\d\s+\-*x]+$/.test(expr.replace(/0x[0-9a-f]+/gi, '0'))) {
            // console.log("Skipping unsafe expression:", expr);
            return null;
        }
        return eval(expr);
    } catch (e) {
        return null;
    }
}

// Regex to find _0x54904b[...]
// Matches _0x54904b[ 0x123 + 0x456 ... ]
const regex = /_0x54904b\[([^\]]+)\]/g;

let replacedSource = source.replace(regex, (match, expr) => {
    const index = evalMath(expr);
    if (index !== null && index >= 0 && index < decodedStrings.length) {
        return JSON.stringify(decodedStrings[index]);
    }
    return match;
});

fs.writeFileSync(path.join(__dirname, 'deobfuscated-funcs-final.js'), replacedSource, 'utf8');
console.log("Done.");
