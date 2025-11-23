const fs = require('fs');
const path = 'c:\\Users\\Nicks\\Desktop\\Flyx-main\\scripts\\reverse-engineering\\prorcp-unpacked.js';

try {
    const content = fs.readFileSync(path, 'utf8');

    const patterns = [
        'decode('
    ];

    patterns.forEach(pattern => {
        let index = content.indexOf(pattern);
        while (index !== -1) {
            console.log(`Found '${pattern}' at index ${index}`);
            // Print context
            const start = Math.max(0, index - 100);
            const end = Math.min(content.length, index + 300);
            console.log(`Context:\n${content.substring(start, end)}\n`);

            index = content.indexOf(pattern, index + 1);
        }
    });

} catch (err) {
    console.error(err);
}
