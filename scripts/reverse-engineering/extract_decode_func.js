const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'pjs_drv_cast_unpacked.js');
const content = fs.readFileSync(filePath, 'utf8');

// Regex to find decode function
// It might be "function decode(x){...}" or "var decode=function(x){...}"
const regex1 = /function\s+decode\s*\(([^)]*)\)\s*\{/g;
const regex2 = /decode\s*=\s*function\s*\(([^)]*)\)\s*\{/g;

let match;

console.log("Searching for 'function decode('...");
while ((match = regex1.exec(content)) !== null) {
    console.log(`Found 'function decode' at index ${match.index}`);
    extractFunction(content, match.index);
}

console.log("Searching for 'decode = function('...");
while ((match = regex2.exec(content)) !== null) {
    console.log(`Found 'decode = function' at index ${match.index}`);
    extractFunction(content, match.index);
}

// Search for salt
const regexSalt = /var\s+salt\s*=\s*\{/g;
const regexSalt2 = /salt\s*=\s*\{/g;

console.log("Searching for 'var salt = {'...");
while ((match = regexSalt.exec(content)) !== null) {
    console.log(`Found 'var salt' at index ${match.index}`);
    extractFunction(content, match.index);
}
console.log("Searching for 'salt = {'...");
while ((match = regexSalt2.exec(content)) !== null) {
    console.log(`Found 'salt =' at index ${match.index}`);
    extractFunction(content, match.index);
}

// Search for pepper
const regexPepper = /function\s+pepper\s*\(([^)]*)\)\s*\{/g;
const regexPepper2 = /pepper\s*=\s*function\s*\(([^)]*)\)\s*\{/g;

console.log("Searching for 'function pepper('...");
while ((match = regexPepper.exec(content)) !== null) {
    console.log(`Found 'function pepper' at index ${match.index}`);
    extractFunction(content, match.index);
}
console.log("Searching for 'pepper = function('...");
while ((match = regexPepper2.exec(content)) !== null) {
    console.log(`Found 'pepper = function' at index ${match.index}`);
    extractFunction(content, match.index);
}

console.log("Searching for 'abc ='...");
let abcIndex = content.indexOf("abc=");
if (abcIndex !== -1) {
    console.log(`Found 'abc=' at index ${abcIndex}`);
    console.log(`Context: ${content.substring(abcIndex, abcIndex + 200)}`);
} else {
    abcIndex = content.indexOf("abc =");
    if (abcIndex !== -1) {
        console.log(`Found 'abc =' at index ${abcIndex}`);
        console.log(`Context: ${content.substring(abcIndex, abcIndex + 200)}`);
    }
}

// Search for sugar
const regexSugar = /function\s+sugar\s*\(([^)]*)\)\s*\{/g;
const regexSugar2 = /sugar\s*=\s*function\s*\(([^)]*)\)\s*\{/g;

console.log("Searching for 'function sugar('...");
while ((match = regexSugar.exec(content)) !== null) {
    console.log(`Found 'function sugar' at index ${match.index}`);
    extractFunction(content, match.index);
}
console.log("Searching for 'sugar = function('...");
while ((match = regexSugar2.exec(content)) !== null) {
    console.log(`Found 'sugar = function' at index ${match.index}`);
    extractFunction(content, match.index);
}

function extractFunction(str, startIndex) {
    let braceCount = 0;
    let endIndex = -1;
    let foundStart = false;

    for (let i = startIndex; i < str.length; i++) {
        if (str[i] === '{') {
            braceCount++;
            foundStart = true;
        } else if (str[i] === '}') {
            braceCount--;
            if (foundStart && braceCount === 0) {
                endIndex = i + 1;
                break;
            }
        }
    }

    if (endIndex !== -1) {
        console.log("Extracted function:");
        console.log(str.substring(startIndex, endIndex));
        console.log("---------------------------------------------------");
    } else {
        console.log("Could not find end of function.");
    }
}
