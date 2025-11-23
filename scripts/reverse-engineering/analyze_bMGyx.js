const fs = require('fs');
const path = require('path');

const scriptPath = path.join(__dirname, 'extra_script.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

const funcName = 'bMGyx71TzQLfdonN';
const start = scriptContent.indexOf(`function ${funcName}(`);
if (start === -1) {
    console.error(`Function ${funcName} not found.`);
    process.exit(1);
}

let braceCount = 0;
let end = -1;
for (let i = start; i < scriptContent.length; i++) {
    if (scriptContent[i] === '{') braceCount++;
    else if (scriptContent[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
            end = i + 1;
            break;
        }
    }
}

const funcCode = scriptContent.substring(start, end);
console.log("Extracted function:");
console.log(funcCode);
