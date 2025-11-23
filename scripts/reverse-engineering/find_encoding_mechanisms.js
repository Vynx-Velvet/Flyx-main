const fs = require('fs');
const path = 'c:\\Users\\Nicks\\Desktop\\Flyx-main\\scripts\\reverse-engineering\\prorcp-unpacked.js';

try {
    const content = fs.readFileSync(path, 'utf8');

    console.log('='.repeat(80));
    console.log('SEARCHING FOR OTHER ENCODING MECHANISMS');
    console.log('='.repeat(80));
    console.log();

    const mechanisms = [];

    // 1. Check for eval() patterns
    console.log('[1] Searching for eval() patterns...');
    const evalPattern = /eval\s*\([^)]+\)/g;
    let evalMatches = content.match(evalPattern) || [];
    console.log(`   Found ${evalMatches.length} eval() calls`);
    if (evalMatches.length > 0) {
        mechanisms.push({
            type: 'eval',
            count: evalMatches.length,
            samples: evalMatches.slice(0, 3).map(m => m.substring(0, 80))
        });
    }

    // 2. Check for atob/btoa (base64)
    console.log('[2] Searching for atob/btoa (standard base64)...');
    const atobPattern = /atob\s*\([^)]+\)/g;
    const btoaPattern = /btoa\s*\([^)]+\)/g;
    let atobMatches = content.match(atobPattern) || [];
    let btoaMatches = content.match(btoaPattern) || [];
    console.log(`   Found ${atobMatches.length} atob() calls`);
    console.log(`   Found ${btoaMatches.length} btoa() calls`);
    if (atobMatches.length > 0 || btoaMatches.length > 0) {
        mechanisms.push({
            type: 'standard_base64',
            atob_count: atobMatches.length,
            btoa_count: btoaMatches.length,
            samples: [...atobMatches.slice(0, 2), ...btoaMatches.slice(0, 2)].map(m => m.substring(0, 80))
        });
    }

    // 3. Check for String.fromCharCode patterns
    console.log('[3] Searching for String.fromCharCode patterns...');
    const charCodePattern = /String\.fromCharCode\s*\([^)]+\)/g;
    let charCodeMatches = content.match(charCodePattern) || [];
    console.log(`   Found ${charCodeMatches.length} String.fromCharCode() calls`);
    if (charCodeMatches.length > 0) {
        mechanisms.push({
            type: 'charcode',
            count: charCodeMatches.length,
            samples: charCodeMatches.slice(0, 3).map(m => m.substring(0, 80))
        });
    }

    // 4. Check for hex encoding
    console.log('[4] Searching for hex encoding patterns...');
    const hexPattern = /0x[0-9A-Fa-f]{2,}/g;
    let hexMatches = content.match(hexPattern) || [];
    console.log(`   Found ${hexMatches.length} hex values`);
    if (hexMatches.length > 0) {
        mechanisms.push({
            type: 'hex',
            count: hexMatches.length,
            samples: hexMatches.slice(0, 5)
        });
    }

    // 5. Check for XOR patterns
    console.log('[5] Searching for XOR operations...');
    const xorPattern = /[\w\s]+\^[\w\s]+/g;
    let xorMatches = content.match(xorPattern) || [];
    console.log(`   Found ${xorMatches.length} XOR operations`);
    if (xorMatches.length > 0) {
        mechanisms.push({
            type: 'xor',
            count: xorMatches.length,
            samples: xorMatches.slice(0, 3).map(m => m.substring(0, 80))
        });
    }

    // 6. Check for encodeURIComponent/decodeURIComponent
    console.log('[6] Searching for URI encoding...');
    const uriEncPattern = /encodeURIComponent\s*\([^)]+\)/g;
    const uriDecPattern = /decodeURIComponent\s*\([^)]+\)/g;
    let uriEncMatches = content.match(uriEncPattern) || [];
    let uriDecMatches = content.match(uriDecPattern) || [];
    console.log(`   Found ${uriEncMatches.length} encodeURIComponent() calls`);
    console.log(`   Found ${uriDecMatches.length} decodeURIComponent() calls`);
    if (uriEncMatches.length > 0 || uriDecMatches.length > 0) {
        mechanisms.push({
            type: 'uri_encoding',
            encode_count: uriEncMatches.length,
            decode_count: uriDecMatches.length,
            samples: [...uriEncMatches.slice(0, 2), ...uriDecMatches.slice(0, 2)].map(m => m.substring(0, 80))
        });
    }

    // 7. Check for escape/unescape
    console.log('[7] Searching for escape/unescape...');
    const escapePattern = /unescape\s*\([^)]+\)/g;
    let escapeMatches = content.match(escapePattern) || [];
    console.log(`   Found ${escapeMatches.length} unescape() calls`);
    if (escapeMatches.length > 0) {
        mechanisms.push({
            type: 'escape',
            count: escapeMatches.length,
            samples: escapeMatches.slice(0, 3).map(m => m.substring(0, 80))
        });
    }

    // 8. Check for custom decode-like functions
    console.log('[8] Searching for custom decode functions...');
    const customDecodePattern = /function\s+(\w*decode\w*|decrypt\w*|unpack\w*)\s*\(/gi;
    let customDecodeMatches = [...content.matchAll(customDecodePattern)];
    console.log(`   Found ${customDecodeMatches.length} custom decode-like functions`);
    if (customDecodeMatches.length > 0) {
        mechanisms.push({
            type: 'custom_decode_functions',
            count: customDecodeMatches.length,
            names: customDecodeMatches.map(m => m[1])
        });
    }

    // 9. Check for the dechar function
    console.log('[9] Searching for dechar function...');
    const decharPattern = /dechar\s*\([^)]+\)/g;
    let decharMatches = content.match(decharPattern) || [];
    console.log(`   Found ${decharMatches.length} dechar() calls`);
    if (decharMatches.length > 0) {
        mechanisms.push({
            type: 'dechar',
            count: decharMatches.length,
            samples: decharMatches.slice(0, 3).map(m => m.substring(0, 80))
        });
    }

    // 10. Check for pepper and sugar functions
    console.log('[10] Searching for pepper/sugar functions...');
    const pepperPattern = /pepper\s*\([^)]+\)/g;
    const sugarPattern = /sugar\s*\([^)]+\)/g;
    let pepperMatches = content.match(pepperPattern) || [];
    let sugarMatches = content.match(sugarPattern) || [];
    console.log(`   Found ${pepperMatches.length} pepper() calls`);
    console.log(`   Found ${sugarMatches.length} sugar() calls`);
    if (pepperMatches.length > 0 || sugarMatches.length > 0) {
        mechanisms.push({
            type: 'pepper_sugar',
            pepper_count: pepperMatches.length,
            sugar_count: sugarMatches.length,
            samples: [...pepperMatches.slice(0, 2), ...sugarMatches.slice(0, 2)].map(m => m.substring(0, 80))
        });
    }

    console.log();
    console.log('='.repeat(80));
    console.log('SUMMARY OF ENCODING MECHANISMS');
    console.log('='.repeat(80));
    console.log();

    mechanisms.forEach((mech, idx) => {
        console.log(`[${idx + 1}] ${mech.type.toUpperCase()}`);
        console.log('-'.repeat(80));
        if (mech.count) console.log(`   Count: ${mech.count}`);
        if (mech.atob_count) console.log(`   atob count: ${mech.atob_count}`);
        if (mech.btoa_count) console.log(`   btoa count: ${mech.btoa_count}`);
        if (mech.encode_count) console.log(`   encode count: ${mech.encode_count}`);
        if (mech.decode_count) console.log(`   decode count: ${mech.decode_count}`);
        if (mech.pepper_count) console.log(`   pepper count: ${mech.pepper_count}`);
        if (mech.sugar_count) console.log(`   sugar count: ${mech.sugar_count}`);
        if (mech.names) console.log(`   Function names: ${mech.names.join(', ')}`);
        if (mech.samples && mech.samples.length > 0) {
            console.log('   Samples:');
            mech.samples.forEach((s, i) => {
                console.log(`      ${i + 1}. ${s}${s.length >= 80 ? '...' : ''}`);
            });
        }
        console.log();
    });

    // Save report
    const report = {
        timestamp: new Date().toISOString(),
        file: path,
        totalMechanisms: mechanisms.length,
        mechanisms: mechanisms
    };

    fs.writeFileSync(
        'c:\\Users\\Nicks\\Desktop\\Flyx-main\\scripts\\reverse-engineering\\encoding_mechanisms.json',
        JSON.stringify(report, null, 2)
    );

    console.log('✓ Report saved to: encoding_mechanisms.json');

} catch (err) {
    console.error('ERROR:', err);
}
