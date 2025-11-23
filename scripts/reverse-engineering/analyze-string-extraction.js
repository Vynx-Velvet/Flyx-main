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

console.log(`Start index: ${startIndex}`);

// Read 2000 characters starting from there to see the context
const context = source.substring(startIndex, startIndex + 2000);
console.log("--- Context Start ---");
console.log(context);
console.log("--- Context End ---");

// Try to find the end of the statement
// It should end with a comma or semicolon, or maybe a closing brace/bracket if it's inside something.
// In the deobfuscated code it was: ... +'-o',_0x135a29["KzKgy"]=...
// So it likely ends with a comma.

let endIndex = -1;
let quoteChar = null;
let inString = false;

// Simple parser to find the end of the expression
for (let i = startIndex; i < source.length; i++) {
    const char = source[i];

    if (inString) {
        if (char === quoteChar && source[i - 1] !== '\\') {
            inString = false;
        }
    } else {
        if (char === '"' || char === "'") {
            inString = true;
            quoteChar = char;
        } else if (char === ',' || char === ';') {
            endIndex = i;
            break;
        }
    }
}

if (endIndex !== -1) {
    console.log(`End index found at: ${endIndex}`);
    const extracted = source.substring(startIndex - 1, endIndex); // Include the opening quote? 
    // Wait, 'pe.d-e... starts with a quote.
    // startIndex is the index of 'p'.
    // So startIndex - 1 should be the quote.

    console.log("--- Extracted Candidate ---");
    console.log(extracted);
    console.log("---------------------------");
} else {
    console.log("Could not find end of expression.");
}
