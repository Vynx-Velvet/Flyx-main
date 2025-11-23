
const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\Nicks\\Desktop\\Flyx-main\\scripts\\reverse-engineering\\prorcp-unpacked.js', 'utf-8');

console.log(`Content length: ${content.length}`);
let index = content.indexOf('decode');
while (index !== -1) {
    console.log(`Found 'decode' at ${index}`);
    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + 50);
    console.log(`Context: ...${content.substring(start, end)}...`);
    index = content.indexOf('decode', index + 1);
}
