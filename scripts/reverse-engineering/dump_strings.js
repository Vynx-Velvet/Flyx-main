const fs = require('fs');
const path = require('path');

const scriptPath = path.join(__dirname, 'extra_script.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

const arrayRegex = /const\s+_0x[a-f0-9]+\s*=\s*(\['[^\]]+'\]);/;
const arrayMatch = scriptContent.match(arrayRegex);

if (arrayMatch) {
    const stringArray = eval(arrayMatch[1]);
    console.log("String Array Content:");
    console.log(JSON.stringify(stringArray, null, 2));
} else {
    console.log("Array not found");
}
