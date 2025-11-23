const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'prorcp-decoder.js');
const outputFile = path.join(__dirname, 'prorcp-unpacked.js');

const content = fs.readFileSync(inputFile, 'utf8');

// Find the start of eval(
const evalStart = content.indexOf('eval(');
if (evalStart === -1) {
    console.error('Could not find eval() in file');
    process.exit(1);
}

const evalContent = content.substring(evalStart);

// We want to execute the function inside eval().
// eval(function(...) { ... } (...))
// We can just replace 'eval' with 'console.log' but that prints to stdout.
// Instead, let's wrap it in a way we can capture the output.

// The structure is eval(expression). We want to evaluate expression.
// So we can just remove 'eval(' and the closing ')'
// But finding the matching closing parenthesis is tricky if there are nested ones.
// However, usually these packed scripts are just one big eval statement.

// Let's try to just run the code with eval replaced by a function that writes to file.
const codeToRun = evalContent.replace('eval', 'return');
// Wrap in a function
const runner = new Function(codeToRun);

try {
    const unpacked = runner();
    fs.writeFileSync(outputFile, unpacked);
    console.log(`Successfully unpacked to ${outputFile}`);
} catch (e) {
    console.error('Error unpacking:', e);
}
