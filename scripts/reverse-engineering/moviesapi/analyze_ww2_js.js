const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, 'ww2_index.js');
const jsCode = fs.readFileSync(jsPath, 'utf8');

const target = '/v1/';
const index = jsCode.indexOf(target);

if (index !== -1) {
    const start = Math.max(0, index);
    const end = Math.min(jsCode.length, index + 2000);
    console.log(`Context for ${target}:`);
    console.log(jsCode.substring(start, end));
} else {
    console.log(`${target} not found.`);
}
