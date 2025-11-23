const fs = require('fs');
const path = require('path');

const bodyFile = path.join(__dirname, 'deobfuscated-script-5-fixed.js');
let body = fs.readFileSync(bodyFile, 'utf8');

if (body.startsWith(',')) {
    body = body.substring(1);
}
body = body.trim();

const helpersStart = body.indexOf('function _0x3d5c48');
if (helpersStart !== -1) {
    let restOfBody = body.substring(helpersStart);

    // 1. Disable _0x54904b execution
    const execLineStart = restOfBody.indexOf('var _0x54904b=');
    if (execLineStart !== -1) {
        const execLineEnd = restOfBody.indexOf(';', execLineStart);
        if (execLineEnd !== -1) {
            restOfBody = restOfBody.substring(0, execLineStart) + 'var _0x54904b = null;' + restOfBody.substring(execLineEnd + 1);
        }
    }

    // 2. Handle _0x3b8f84 and _0xad4dfd
    const zvBjfCall = "_0x22f029['zvBjf'](_0xad4dfd);";
    const zvBjfIndex = restOfBody.indexOf(zvBjfCall);
    const varBlockStart = restOfBody.indexOf('var _0x3b8f84=');

    if (zvBjfIndex !== -1 && varBlockStart !== -1 && varBlockStart < zvBjfIndex) {
        const mocks = "var _0x3b8f84={}, _0xad4dfd={}; ";
        restOfBody = restOfBody.substring(0, varBlockStart) + mocks + restOfBody.substring(zvBjfIndex);

        const newZvBjfIndex = restOfBody.indexOf(zvBjfCall);
        if (newZvBjfIndex !== -1) {
            restOfBody = restOfBody.substring(0, newZvBjfIndex) + "/* " + zvBjfCall + " */" + restOfBody.substring(newZvBjfIndex + zvBjfCall.length);
        }
    }

    // Check for syntax errors
    try {
        new Function(restOfBody);
        console.log("Syntax check passed!");
    } catch (e) {
        console.error("Syntax check failed:", e.message);
        // Try to find the location
        // Node.js SyntaxError stack trace usually contains the code snippet
        console.log(e.stack);
    }
}
