const fs = require('fs');
const html = fs.readFileSync('debug-prorcp-550.html', 'utf8');
const match = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);

if (!match) {
    console.log('No match found');
    process.exit(1);
}

const encoded = match[2];
console.log('Div ID:', match[1]);
console.log('Length:', encoded.length);
console.log('First 80:', encoded.substring(0, 80));

// Check character set
const chars = new Set(encoded.split(''));
console.log('\nUnique chars:', [...chars].sort().join(''));

// The content starts with = which is unusual for base64
// Let's try different approaches

// 1. Maybe it's already URL-safe base64 that needs to be decoded directly
console.log('\n--- Try 1: Direct base64 decode ---');
try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    console.log('Result:', decoded.substring(0, 100));
} catch (e) {
    console.log('Error:', e.message);
}

// 2. Maybe we need to reverse first, then base64
console.log('\n--- Try 2: Reverse then base64 ---');
try {
    const reversed = encoded.split('').reverse().join('');
    const replaced = reversed.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(replaced, 'base64').toString('utf8');
    console.log('Result:', decoded.substring(0, 100));
} catch (e) {
    console.log('Error:', e.message);
}

// 3. Maybe it's XOR encrypted
console.log('\n--- Try 3: XOR with common keys ---');
function xorDecode(str, key) {
    const bytes = Buffer.from(str, 'base64');
    const result = Buffer.alloc(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
        result[i] = bytes[i] ^ key.charCodeAt(i % key.length);
    }
    return result.toString('utf8');
}

['key', '123', 'abc', 'secret'].forEach(key => {
    try {
        const result = xorDecode(encoded, key);
        if (result.includes('http') || result.includes('m3u8')) {
            console.log(`Key "${key}":`, result.substring(0, 100));
        }
    } catch (e) {}
});

// 4. Check if it looks like the content from the working example
console.log('\n--- Compare with known working format ---');
// The working format from superembed-prorcp-550.html started with: 7gnNwFzd2x2byADM
// This one starts with: =0je4I3M5hnbxRjMyYkRGZkV_1E
console.log('This format starts with:', encoded.substring(0, 30));
console.log('Known working starts with: 7gnNwFzd2x2byADM...');

// 5. Try the exact same decoder that worked before but check intermediate steps
console.log('\n--- Debug OLD decoder steps ---');
const reversed = encoded.split('').reverse().join('');
console.log('After reverse (first 50):', reversed.substring(0, 50));
const replaced = reversed.replace(/-/g, '+').replace(/_/g, '/');
console.log('After replace (first 50):', replaced.substring(0, 50));
try {
    const b64decoded = Buffer.from(replaced, 'base64');
    console.log('Base64 decoded length:', b64decoded.length);
    console.log('First 20 bytes:', [...b64decoded.slice(0, 20)].map(b => b.toString(16).padStart(2, '0')).join(' '));
} catch (e) {
    console.log('Base64 error:', e.message);
}
