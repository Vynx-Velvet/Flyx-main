const fs = require('fs');

const file = 'debug-prorcp-680.html';
const html = fs.readFileSync(file, 'utf8');
const match = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);

const encoded = match[2];
console.log('Length:', encoded.length);
console.log('First 40:', encoded.substring(0, 40));

// Try many different approaches
function tryAllShifts(decoded, label) {
    for (const shift of [-10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
        let result = '';
        for (let i = 0; i < decoded.length; i++) {
            result += String.fromCharCode(decoded.charCodeAt(i) + shift);
        }
        if (result.includes('https://') || result.includes('http://')) {
            console.log(`${label} shift ${shift}: ${result.substring(0, 100)}`);
            return true;
        }
    }
    return false;
}

// 1. Direct base64
console.log('\n--- 1. Direct base64 ---');
try {
    const decoded = Buffer.from(encoded, 'base64').toString('binary');
    if (!tryAllShifts(decoded, 'Direct')) {
        console.log('No match');
    }
} catch (e) {
    console.log('Error:', e.message);
}

// 2. Reverse then base64
console.log('\n--- 2. Reverse then base64 ---');
try {
    const reversed = encoded.split('').reverse().join('');
    const decoded = Buffer.from(reversed, 'base64').toString('binary');
    if (!tryAllShifts(decoded, 'Reverse')) {
        console.log('No match');
    }
} catch (e) {
    console.log('Error:', e.message);
}

// 3. URL-safe base64 variants
console.log('\n--- 3. URL-safe base64 (reverse) ---');
try {
    const reversed = encoded.split('').reverse().join('');
    const replaced = reversed.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(replaced, 'base64').toString('binary');
    if (!tryAllShifts(decoded, 'URL-safe reverse')) {
        console.log('No match');
    }
} catch (e) {
    console.log('Error:', e.message);
}

// 4. Custom alphabet (like the salt decoder)
console.log('\n--- 4. Custom alphabet base64 ---');
const customAlphabet = "ABCDEFGHIJKLMabcdefghijklmNOPQRSTUVWXYZnopqrstuvwxyz0123456789+/";
const standardAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function customBase64Decode(str, fromAlpha, toAlpha) {
    let translated = '';
    for (const c of str) {
        const idx = fromAlpha.indexOf(c);
        if (idx >= 0) {
            translated += toAlpha[idx];
        } else {
            translated += c;
        }
    }
    return Buffer.from(translated, 'base64').toString('binary');
}

try {
    const decoded = customBase64Decode(encoded, customAlphabet, standardAlphabet);
    if (!tryAllShifts(decoded, 'Custom alpha')) {
        console.log('No match');
    }
} catch (e) {
    console.log('Error:', e.message);
}

// 5. Try reverse with custom alphabet
console.log('\n--- 5. Reverse + custom alphabet ---');
try {
    const reversed = encoded.split('').reverse().join('');
    const decoded = customBase64Decode(reversed, customAlphabet, standardAlphabet);
    if (!tryAllShifts(decoded, 'Reverse custom')) {
        console.log('No match');
    }
} catch (e) {
    console.log('Error:', e.message);
}

// 6. Double reverse
console.log('\n--- 6. Double operations ---');
try {
    const reversed = encoded.split('').reverse().join('');
    const replaced = reversed.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(replaced, 'base64').toString('binary');
    const doubleReversed = decoded.split('').reverse().join('');
    if (!tryAllShifts(doubleReversed, 'Double reverse')) {
        console.log('No match');
    }
} catch (e) {
    console.log('Error:', e.message);
}
