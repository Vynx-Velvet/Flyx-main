const fs = require('fs');
const path = require('path');

const encrypted = fs.readFileSync(path.join(__dirname, 'encrypted_CloudStream_Pro.txt'), 'utf8');

console.log("Encrypted length:", encrypted.length);
console.log("Start:", encrypted.substring(0, 50));

function attemptDecode(str, shift) {
    let result = '';
    for (let i = 0; i < str.length; i++) {
        result += String.fromCharCode(str.charCodeAt(i) + shift);
    }
    return result;
}

function reverse(str) {
    return str.split('').reverse().join('');
}

function rot13(str) {
    return str.replace(/[a-zA-Z]/g, function (c) {
        return String.fromCharCode((c <= 'Z' ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26);
    });
}

function rot(str, n) {
    return str.replace(/[a-zA-Z]/g, function (c) {
        const base = c <= 'Z' ? 65 : 97;
        return String.fromCharCode(base + (c.charCodeAt(0) - base + n) % 26);
    });
}

// Try various combinations
const attempts = [];

// 1. Shift -3
attempts.push({ name: 'Shift -3', val: attemptDecode(encrypted, -3) });
// 2. Shift +3
attempts.push({ name: 'Shift +3', val: attemptDecode(encrypted, 3) });
// 3. Reverse then Shift -3
attempts.push({ name: 'Rev, Shift -3', val: attemptDecode(reverse(encrypted), -3) });
// 4. ROT47
// 5. ROT13
attempts.push({ name: 'ROT13', val: rot13(encrypted) });

// 6. Custom ROT3 (a->d) on reversed
// The script had x->a (shift +3). To decrypt, we need shift -3 (or +23).
attempts.push({ name: 'Rev, ROT-3', val: rot(reverse(encrypted), 23) });

// 7. Try to treat as Hex after shift
// 946844...
// If we shift -3: 613511...
// 61 is 'a'. 35 is '5'.
// Let's try to hex decode the Shift -3 result.
function hexDecode(str) {
    try {
        let result = '';
        for (let i = 0; i < str.length; i += 2) {
            result += String.fromCharCode(parseInt(str.substr(i, 2), 16));
        }
        return result;
    } catch (e) { return null; }
}

attempts.push({ name: 'Shift -3, Hex', val: hexDecode(attemptDecode(encrypted, -3)) });
attempts.push({ name: 'Rev, Shift -3, Hex', val: hexDecode(attemptDecode(reverse(encrypted), -3)) });

// Check results
for (const attempt of attempts) {
    if (attempt.val) {
        console.log(`--- ${attempt.name} ---`);
        console.log(attempt.val.substring(0, 100));
        if (attempt.val.includes('http') || attempt.val.includes('.m3u8') || attempt.val.includes('#EXTM3U')) {
            console.log("!!! POTENTIAL MATCH !!!");
        }
    }
}
