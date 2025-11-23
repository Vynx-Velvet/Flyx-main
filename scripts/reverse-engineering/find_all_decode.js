const fs = require('fs');
const path = 'c:\\Users\\Nicks\\Desktop\\Flyx-main\\scripts\\reverse-engineering\\prorcp-unpacked.js';

try {
    const content = fs.readFileSync(path, 'utf8');

    const regex = /decode\(['"](#[^'"]+)['"]\)/g;
    let match;
    let count = 0;
    const samples = [];

    while ((match = regex.exec(content)) !== null) {
        count++;
        if (count <= 10) {
            samples.push({
                index: match.index,
                encoded: match[1],
                preview: match[1].substring(0, 50) + (match[1].length > 50 ? '...' : '')
            });
        }
    }

    console.log(`Total decode() calls found: ${count}\n`);
    console.log('First 10 samples:\n');
    samples.forEach((s, i) => {
        console.log(`${i + 1}. Index: ${s.index}`);
        console.log(`   Encoded: ${s.preview}\n`);
    });

} catch (err) {
    console.error(err);
}
