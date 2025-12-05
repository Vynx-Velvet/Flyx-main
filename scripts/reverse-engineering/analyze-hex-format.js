const fs = require('fs');

// Read the debug files with hex format
['debug-prorcp-1396.html', 'debug-prorcp-680.html'].forEach(file => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Analyzing: ${file}`);
    console.log('='.repeat(60));
    
    const html = fs.readFileSync(file, 'utf8');
    const match = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
    
    if (!match) {
        console.log('No hidden div found');
        return;
    }
    
    const divId = match[1];
    const encoded = match[2];
    
    console.log('Div ID:', divId);
    console.log('Length:', encoded.length);
    console.log('First 80:', encoded.substring(0, 80));
    
    // This looks like pure hex - try hex decode
    console.log('\n--- Try 1: Direct hex decode ---');
    try {
        let decoded = '';
        for (let i = 0; i < encoded.length; i += 2) {
            decoded += String.fromCharCode(parseInt(encoded.substr(i, 2), 16));
        }
        console.log('Result (first 100):', decoded.substring(0, 100));
        if (decoded.includes('http')) console.log('✅ Contains http!');
    } catch (e) {
        console.log('Error:', e.message);
    }
    
    // Try hex decode then shift
    console.log('\n--- Try 2: Hex decode then shift -5 ---');
    try {
        let hexDecoded = '';
        for (let i = 0; i < encoded.length; i += 2) {
            hexDecoded += String.fromCharCode(parseInt(encoded.substr(i, 2), 16));
        }
        let shifted = '';
        for (let i = 0; i < hexDecoded.length; i++) {
            shifted += String.fromCharCode(hexDecoded.charCodeAt(i) - 5);
        }
        console.log('Result (first 100):', shifted.substring(0, 100));
        if (shifted.includes('http')) console.log('✅ Contains http!');
    } catch (e) {
        console.log('Error:', e.message);
    }
    
    // Try XOR with various keys
    console.log('\n--- Try 3: Hex decode then XOR ---');
    function hexDecodeXor(str, key) {
        let hexDecoded = '';
        for (let i = 0; i < str.length; i += 2) {
            hexDecoded += String.fromCharCode(parseInt(str.substr(i, 2), 16));
        }
        let result = '';
        for (let i = 0; i < hexDecoded.length; i++) {
            result += String.fromCharCode(hexDecoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return result;
    }
    
    // Try common XOR keys
    const keys = ['key', 'secret', 'cloudnestra', divId, '123456', 'abcdef'];
    for (const key of keys) {
        const result = hexDecodeXor(encoded, key);
        if (result.includes('http') || result.includes('m3u8')) {
            console.log(`Key "${key}": ${result.substring(0, 100)}`);
            console.log('✅ FOUND!');
        }
    }
    
    // Try reverse then hex decode
    console.log('\n--- Try 4: Reverse then hex decode ---');
    try {
        const reversed = encoded.split('').reverse().join('');
        let decoded = '';
        for (let i = 0; i < reversed.length; i += 2) {
            decoded += String.fromCharCode(parseInt(reversed.substr(i, 2), 16));
        }
        console.log('Result (first 100):', decoded.substring(0, 100));
        if (decoded.includes('http')) console.log('✅ Contains http!');
    } catch (e) {
        console.log('Error:', e.message);
    }
    
    // Try the OLD format decoder (reverse, -1, hex)
    console.log('\n--- Try 5: OLD format (reverse, -1, hex) ---');
    try {
        const reversed = encoded.split('').reverse().join('');
        let adjusted = '';
        for (let i = 0; i < reversed.length; i++) {
            adjusted += String.fromCharCode(reversed.charCodeAt(i) - 1);
        }
        let decoded = '';
        for (let i = 0; i < adjusted.length; i += 2) {
            const charCode = parseInt(adjusted.substr(i, 2), 16);
            if (!isNaN(charCode)) {
                decoded += String.fromCharCode(charCode);
            }
        }
        console.log('Result (first 100):', decoded.substring(0, 100));
        if (decoded.includes('http')) console.log('✅ Contains http!');
    } catch (e) {
        console.log('Error:', e.message);
    }
});
