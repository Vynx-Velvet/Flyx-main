const fs = require('fs');

const file = 'debug-prorcp-1396.html';
const html = fs.readFileSync(file, 'utf8');
const match = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);

const divId = match[1];
const encoded = match[2];

console.log('Div ID:', divId);
console.log('Reversed:', divId.split('').reverse().join(''));

function hexToBytes(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
}

const fullBytes = hexToBytes(encoded);
console.log('Total bytes:', fullBytes.length);

// The decoder function name is the reversed div ID
// Maybe the key is also derived from the reversed div ID
const reversedDivId = divId.split('').reverse().join('');

console.log('\n=== Trying reversed div ID variations ===\n');

// Try reversed div ID as key
function tryDecode(key, name) {
    let decoded = '';
    for (let i = 0; i < Math.min(300, fullBytes.length); i++) {
        const keyByte = key.charCodeAt(i % key.length);
        decoded += String.fromCharCode(fullBytes[i] ^ keyByte);
    }
    
    if (decoded.includes('https://') || decoded.includes('{"file"') || decoded.includes('tmstr')) {
        console.log(`✅ ${name}:`);
        console.log(`   Key: ${key}`);
        console.log(`   Decoded: ${decoded.substring(0, 200)}`);
        return true;
    }
    return false;
}

tryDecode(reversedDivId, 'Reversed DivId');

// The function name in the script is "MyL1IRSfHe" which is close to "eSfH1IRMyL" reversed
// But not exactly - let's check
console.log('\nDiv ID:', divId);
console.log('Reversed:', reversedDivId);
console.log('Script uses: MyL1IRSfHe');

// Maybe the key is derived differently
// Let's try: key = divId XOR with its reverse
let xorKey = '';
for (let i = 0; i < divId.length; i++) {
    xorKey += String.fromCharCode(divId.charCodeAt(i) ^ reversedDivId.charCodeAt(i));
}
console.log('\nDivId XOR Reversed:', xorKey.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' '));
tryDecode(xorKey, 'DivId XOR Reversed');

// Try: key = each char of divId XOR with position
let posKey = '';
for (let i = 0; i < 32; i++) {
    posKey += String.fromCharCode(divId.charCodeAt(i % divId.length) ^ i);
}
tryDecode(posKey, 'DivId XOR Position');

// Try: key = reversed divId repeated
tryDecode(reversedDivId.repeat(5), 'Reversed DivId x5');

// The script hash might be involved
const scriptHash = html.match(/sV05kUlNvOdOxvtC\/([a-f0-9]+)\.js/);
if (scriptHash) {
    const hash = scriptHash[1];
    console.log('\nScript hash:', hash);
    
    // Try: key = reversedDivId + hash
    tryDecode(reversedDivId + hash, 'Reversed + Hash');
    
    // Try: key = hash + reversedDivId
    tryDecode(hash + reversedDivId, 'Hash + Reversed');
    
    // Try: XOR of reversed divId and hash
    let xorHashKey = '';
    for (let i = 0; i < Math.max(reversedDivId.length, hash.length); i++) {
        const a = reversedDivId.charCodeAt(i % reversedDivId.length);
        const b = hash.charCodeAt(i % hash.length);
        xorHashKey += String.fromCharCode(a ^ b);
    }
    tryDecode(xorHashKey, 'Reversed XOR Hash');
}

// Let's also check what the actual decoder does
// From the script end: window[bMGyx71TzQLfdonN("MyL1IRSfHe")] = MyL1IRSfHe(document.getElementById(bMGyx71TzQLfdonN("MyL1IRSfHe")).innerHTML);
// bMGyx71TzQLfdonN reverses the string
// So: window["eSfH1IR1LyM"] = MyL1IRSfHe(document.getElementById("eSfH1IR1LyM").innerHTML);
// Wait - "MyL1IRSfHe" reversed is "eHfSRI1LyM" not "eSfH1IRMyL"

console.log('\n=== Checking string reversal ===');
console.log('"MyL1IRSfHe" reversed:', 'MyL1IRSfHe'.split('').reverse().join(''));
console.log('Div ID:', divId);

// They're different! The function name is NOT the reversed div ID
// Let me check the actual div ID in the file
const divIdFromFile = match[1];
console.log('Actual div ID from file:', divIdFromFile);
console.log('Reversed:', divIdFromFile.split('').reverse().join(''));
