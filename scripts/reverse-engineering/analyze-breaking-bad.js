const fs = require('fs');

const file = 'debug-prorcp-1396.html';
const html = fs.readFileSync(file, 'utf8');
const match = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);

const encoded = match[2];
console.log('Breaking Bad encoded:');
console.log('Length:', encoded.length);
console.log('First 50:', encoded.substring(0, 50));
console.log('= positions:', [...encoded].map((c, i) => c === '=' ? i : null).filter(x => x !== null).slice(0, 10));

// The = is at position 1, so maybe we need to strip first char?
console.log('\n--- Try stripping first char ---');
const stripped = encoded.substring(1);
console.log('Stripped first 50:', stripped.substring(0, 50));

const reversed = stripped.split('').reverse().join('');
const replaced = reversed.replace(/-/g, '+').replace(/_/g, '/');
const decoded = Buffer.from(replaced, 'base64').toString('binary');

console.log('Decoded length:', decoded.length);

for (const shift of [3, 5, 7, 9]) {
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
        result += String.fromCharCode(decoded.charCodeAt(i) - shift);
    }
    if (result.includes('https://')) {
        console.log(`✅ Shift ${shift} works!`);
        console.log('First 100:', result.substring(0, 100));
        break;
    }
}

// Now try Pulp Fiction with same approach
console.log('\n\n=== Pulp Fiction ===');
const pf = fs.readFileSync('debug-prorcp-680.html', 'utf8');
const pfMatch = pf.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
const pfEncoded = pfMatch[2];

console.log('First 50:', pfEncoded.substring(0, 50));
console.log('= positions:', [...pfEncoded].map((c, i) => c === '=' ? i : null).filter(x => x !== null).slice(0, 10));

// Try stripping first char anyway
const pfStripped = pfEncoded.substring(1);
const pfReversed = pfStripped.split('').reverse().join('');
const pfReplaced = pfReversed.replace(/-/g, '+').replace(/_/g, '/');

try {
    const pfDecoded = Buffer.from(pfReplaced, 'base64').toString('binary');
    console.log('Decoded length:', pfDecoded.length);
    
    for (const shift of [3, 5, 7, 9, 11]) {
        let result = '';
        for (let i = 0; i < pfDecoded.length; i++) {
            result += String.fromCharCode(pfDecoded.charCodeAt(i) - shift);
        }
        if (result.includes('https://')) {
            console.log(`✅ Shift ${shift} works!`);
            console.log('First 100:', result.substring(0, 100));
            break;
        }
    }
} catch (e) {
    console.log('Error:', e.message);
}
