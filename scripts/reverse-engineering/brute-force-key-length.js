const fs = require('fs');

const file = 'debug-prorcp-1396.html';
const html = fs.readFileSync(file, 'utf8');
const match = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);

const divId = match[1];
const encoded = match[2];

function hexToBytes(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
}

const fullBytes = hexToBytes(encoded);
console.log('Div ID:', divId);
console.log('Total bytes:', fullBytes.length);

// We know the plaintext should contain "https://" somewhere
// Let's find all positions where "https://" could be and derive the key

const target = 'https://';
const targetBytes = target.split('').map(c => c.charCodeAt(0));

console.log('\n=== Finding potential "https://" positions ===\n');

const potentialKeys = [];

for (let pos = 0; pos < Math.min(100, fullBytes.length - targetBytes.length); pos++) {
    // Derive key at this position
    const keyFragment = [];
    for (let i = 0; i < targetBytes.length; i++) {
        keyFragment.push(fullBytes[pos + i] ^ targetBytes[i]);
    }
    
    // Check if this key fragment looks reasonable
    const keyStr = keyFragment.map(b => String.fromCharCode(b)).join('');
    const isPrintable = keyFragment.every(b => b >= 32 && b < 127);
    
    if (isPrintable) {
        potentialKeys.push({ pos, key: keyFragment, keyStr });
    }
}

console.log(`Found ${potentialKeys.length} potential positions with printable keys`);

// For each potential key, try to find a repeating pattern
for (const { pos, key, keyStr } of potentialKeys.slice(0, 10)) {
    console.log(`\nPosition ${pos}: key = "${keyStr}"`);
    
    // Try extending the key by looking at what comes after "https://"
    // Common patterns: "https://tmstr", "https://cdn", "https://putgate"
    const extensions = ['tmstr', 'cdn.', 'putgate', 'cloudnestra'];
    
    for (const ext of extensions) {
        const fullTarget = target + ext;
        const fullTargetBytes = fullTarget.split('').map(c => c.charCodeAt(0));
        
        if (pos + fullTargetBytes.length > fullBytes.length) continue;
        
        const extendedKey = [];
        for (let i = 0; i < fullTargetBytes.length; i++) {
            extendedKey.push(fullBytes[pos + i] ^ fullTargetBytes[i]);
        }
        
        const extKeyStr = extendedKey.map(b => String.fromCharCode(b)).join('');
        const extIsPrintable = extendedKey.every(b => b >= 32 && b < 127);
        
        if (extIsPrintable) {
            console.log(`  Extended with "${ext}": key = "${extKeyStr}"`);
            
            // Try using this key to decode more
            let decoded = '';
            for (let i = 0; i < Math.min(300, fullBytes.length); i++) {
                decoded += String.fromCharCode(fullBytes[i] ^ extendedKey[i % extendedKey.length]);
            }
            
            // Count how many valid URLs we find
            const urlCount = (decoded.match(/https:\/\//g) || []).length;
            const hasM3u8 = decoded.includes('.m3u8');
            const hasJson = decoded.includes('{"file"') || decoded.includes('"file":');
            
            if (urlCount > 1 || hasM3u8 || hasJson) {
                console.log(`    ✅ Promising! URLs: ${urlCount}, m3u8: ${hasM3u8}, JSON: ${hasJson}`);
                console.log(`    Decoded: ${decoded.substring(0, 200)}`);
            }
        }
    }
}

// Also try: the key might be the div ID with some transformation
console.log('\n=== Trying div ID transformations ===\n');

// Key might be divId repeated to some length
for (let keyLen = divId.length; keyLen <= 64; keyLen += divId.length) {
    const key = divId.repeat(Math.ceil(keyLen / divId.length)).substring(0, keyLen);
    
    // Try with different starting positions in the data
    for (let dataStart = 0; dataStart < 20; dataStart++) {
        let decoded = '';
        for (let i = dataStart; i < Math.min(dataStart + 200, fullBytes.length); i++) {
            decoded += String.fromCharCode(fullBytes[i] ^ key.charCodeAt((i - dataStart) % key.length));
        }
        
        if (decoded.includes('https://') && decoded.includes('.m3u8')) {
            console.log(`✅ Found! Key length: ${keyLen}, data start: ${dataStart}`);
            console.log(`   Decoded: ${decoded.substring(0, 200)}`);
        }
    }
}
