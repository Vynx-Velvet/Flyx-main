const fs = require('fs');
const path = require('path');

const scriptPath = path.join(__dirname, 'deobfuscated-script-5.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

console.log('=== Analyzing String Literals in Script 5 ===\n');

// Regex to find string literals (single or double quotes)
const stringPattern = /(['"])(.*?)\1/g;
let match;
const strings = new Set();

while ((match = stringPattern.exec(scriptContent)) !== null) {
    const str = match[2];
    if (str.length > 4) { // Filter out short strings
        strings.add(str);
    }
}

console.log(`Found ${strings.size} unique string literals:\n`);
Array.from(strings).sort().forEach(str => {
    console.log(str);
});

console.log('\n=== Analyzing Potential URL Patterns ===\n');
const urlPattern = /https?:\/\/[^\s"']+/g;
while ((match = urlPattern.exec(scriptContent)) !== null) {
    console.log('URL found:', match[0]);
}

console.log('\n=== Analyzing Potential API Endpoints ===\n');
const apiPattern = /\/api\/[^\s"']+/g;
while ((match = apiPattern.exec(scriptContent)) !== null) {
    console.log('API Endpoint found:', match[0]);
}
