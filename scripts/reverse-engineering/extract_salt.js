
const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\Nicks\\Desktop\\Flyx-main\\scripts\\reverse-engineering\\prorcp-unpacked.js', 'utf-8');

const start = 193391 + 500; // Skip decode function body
const length = 1000;
const chunk = content.substring(start, start + length);

console.log("--- SALT OBJECT START ---");
console.log(chunk);
console.log("--- SALT OBJECT END ---");
