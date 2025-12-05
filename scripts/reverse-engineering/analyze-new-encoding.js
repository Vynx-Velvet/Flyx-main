const fs = require('fs');

const file = 'debug-prorcp-550.html';
const html = fs.readFileSync(file, 'utf8');
const match = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);

const divId = match[1];
const encoded = match[2];

console.log('Div ID:', divId);
console.log('Length:', encoded.length);
console.log('First 80:', encoded.substring(0, 80));
console.log('Last 40:', encoded.substring(encoded.length - 40));

// The encoded string starts with = which is unusual
// Let's try different approaches

// 1. Maybe it's already reversed?
console.log('\n--- Try 1: Direct base64 (no reverse) ---');
try {
    const replaced = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(replaced, 'base64').toString('binary');
    console.log('First 80:', decoded.substring(0, 80));
    
    // Try shift
    for (const shift of [3, 5, -3, -5]) {
        let result = '';
        for (let i = 0; i < decoded.length; i++) {
            result += String.fromCharCode(decoded.charCodeAt(i) - shift);
        }
        if (result.includes('http')) {
            console.log(`Shift ${shift}: ${result.substring(0, 100)}`);
        }
    }
} catch (e) {
    console.log('Error:', e.message);
}

// 2. Try reverse then base64
console.log('\n--- Try 2: Reverse then base64 ---');
try {
    const reversed = encoded.split('').reverse().join('');
    const replaced = reversed.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(replaced, 'base64').toString('binary');
    console.log('First 80:', decoded.substring(0, 80));
    
    // Try shift
    for (const shift of [3, 5, -3, -5, 1, 2, 4, 6]) {
        let result = '';
        for (let i = 0; i < decoded.length; i++) {
            result += String.fromCharCode(decoded.charCodeAt(i) - shift);
        }
        if (result.includes('http')) {
            console.log(`Shift ${shift}: ${result.substring(0, 100)}`);
        }
    }
} catch (e) {
    console.log('Error:', e.message);
}

// 3. Check if it's a different base64 alphabet
console.log('\n--- Analyzing character distribution ---');
const chars = {};
for (const c of encoded) {
    chars[c] = (chars[c] || 0) + 1;
}
const sortedChars = Object.entries(chars).sort((a, b) => b[1] - a[1]);
console.log('Top 10 chars:', sortedChars.slice(0, 10).map(([c, n]) => `${c}:${n}`).join(', '));

// 4. Check if the = is padding or part of content
console.log('\n--- Checking = positions ---');
const eqPositions = [];
for (let i = 0; i < encoded.length; i++) {
    if (encoded[i] === '=') eqPositions.push(i);
}
console.log('= positions (first 10):', eqPositions.slice(0, 10));
console.log('Total = count:', eqPositions.length);
