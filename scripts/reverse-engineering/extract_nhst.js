
const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\Nicks\\Desktop\\Flyx-main\\scripts\\reverse-engineering\\prorcp-unpacked.js', 'utf-8');

const start = 61743;
const length = 2000;
const chunk = content.substring(start, start + length);

console.log("--- NHstzFhZ START ---");
console.log(chunk);
console.log("--- NHstzFhZ END ---");
