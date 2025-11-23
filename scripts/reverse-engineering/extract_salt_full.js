const fs = require('fs');
const path = 'c:\\Users\\Nicks\\Desktop\\Flyx-main\\scripts\\reverse-engineering\\prorcp-unpacked.js';

try {
    const content = fs.readFileSync(path, 'utf8');
    const startPattern = 'var salt={';
    const startIndex = content.indexOf(startPattern);

    if (startIndex !== -1) {
        let braceCount = 0;
        let endIndex = -1;

        for (let i = startIndex + startPattern.length - 1; i < content.length; i++) {
            if (content[i] === '{') braceCount++;
            else if (content[i] === '}') braceCount--;

            if (braceCount === 0) {
                endIndex = i + 1;
                break;
            }
        }

        if (endIndex !== -1) {
            const saltCode = content.substring(startIndex, endIndex);
            console.log(saltCode);
        } else {
            console.log('Could not find end of salt object');
        }
    } else {
        console.log('Could not find salt object');
    }

} catch (err) {
    console.error(err);
}
