const fs = require('fs');

const file = 'debug-prorcp-680.html';
const html = fs.readFileSync(file, 'utf8');
const match = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);

if (!match) {
    console.log('No hidden div found');
    process.exit(1);
}

const divId = match[1];
const encoded = match[2];

console.log('Div ID:', divId);
console.log('Length:', encoded.length);
console.log('First 80:', encoded.substring(0, 80));
console.log('First char code:', encoded.charCodeAt(0));

// Try all approaches
function tryDecode(str, stripFirst) {
    let input = stripFirst ? str.substring(1) : str;
    let reversed = input.split('').reverse().join('');
    let replaced = reversed.replace(/-/g, '+').replace(/_/g, '/');
    
    try {
        let decoded = Buffer.from(replaced, 'base64').toString('binary');
        
        for (const shift of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
            let result = '';
            for (let i = 0; i < decoded.length; i++) {
                result += String.fromCharCode(decoded.charCodeAt(i) - shift);
            }
            if (result.includes('https://')) {
                return { shift, stripped: stripFirst, result: result.substring(0, 150) };
            }
        }
    } catch (e) {
        return { error: e.message };
    }
    return null;
}

console.log('\n--- Try without stripping ---');
let result = tryDecode(encoded, false);
if (result) {
    console.log('Found:', result);
} else {
    console.log('Not found');
}

console.log('\n--- Try with stripping first char ---');
result = tryDecode(encoded, true);
if (result) {
    console.log('Found:', result);
} else {
    console.log('Not found');
}

// Check if it's a different format entirely
console.log('\n--- Character analysis ---');
const first20 = encoded.substring(0, 20);
console.log('First 20:', first20);
console.log('Is hex?', /^[0-9a-f]+$/i.test(first20));
console.log('Has =?', encoded.includes('='));
console.log('= count:', (encoded.match(/=/g) || []).length);
