/**
 * ANALYZE THE EXAMPLE HTML YOU PROVIDED
 * 
 * Looking for the actual server/source structure
 */

const exampleHTML = `examples/vidsrc_4-1763003986223.html`;

console.log('🔍 ANALYZING EXAMPLE HTML STRUCTURE\n');
console.log('='.repeat(80) + '\n');

// The key insight: this is an SrcRCP player page
// Let's look for what makes it different from ProRCP

console.log('Key observations from the example HTML:\n');
console.log('1. It has window[\'x4G9Tq2Kw6R7v1Dy3P0B5N8Lc9M2zF\'] with ad config');
console.log('2. It has window[\'ZpQw9XkLmN8c3vR3\'] with 752 char base64 (encrypted data)');
console.log('3. It has array "f" with ad script URLs');
console.log('4. It has a massive inline script (230KB+)');
console.log('5. It has custom elements like <in-page-message>');
console.log('');

console.log('The window[\'ZpQw9XkLmN8c3vR3\'] variable is 752 chars of base64.');
console.log('When decoded, it\'s binary/encrypted data - NOT plain text.');
console.log('This is likely the ENCRYPTED M3U8 URL or source list!\n');

console.log('='.repeat(80));
console.log('HYPOTHESIS\n');
console.log('='.repeat(80) + '\n');

console.log('Superembed SrcRCP works like this:\n');
console.log('1. The page loads with window[\'ZpQw9XkLmN8c3vR3\'] = ENCRYPTED_DATA');
console.log('2. The 230KB inline script contains the decryption logic');
console.log('3. JavaScript decrypts the data to get M3U8 URL');
console.log('4. The M3U8 URL is NOT in the HTML source\n');

console.log('This is EXACTLY like cloudstream\'s ProRCP:');
console.log('- ProRCP: Hidden <div> with base64 → decrypt with Playerjs');
console.log('- SrcRCP: window variable with base64 → decrypt with inline script\n');

console.log('='.repeat(80));
console.log('SOLUTION\n');
console.log('='.repeat(80) + '\n');

console.log('To extract M3U8 from Superembed with PURE FETCH:\n');
console.log('1. ✅ Fetch VidSrc page');
console.log('2. ✅ Extract Superembed hash');
console.log('3. ✅ Fetch RCP page');
console.log('4. ✅ Extract SrcRCP URL');
console.log('5. ✅ Fetch SrcRCP player page');
console.log('6. ✅ Extract window[\'ZpQw9XkLmN8c3vR3\'] base64 data');
console.log('7. ❌ DECRYPT the data (requires reverse engineering the 230KB script)');
console.log('8. ❌ OR use the same decoders we use for ProRCP\n');

console.log('Let\'s try applying our existing decoders to this data!\n');

const encoded = 'A3BYEDFXAjpTA3MiGjcMFnADViZdGCZOG100ECEKDiYXAydQAyVCFBVhVSUAFAJYACoQSm4ZFQRjBz4VWn4bFSZQJilEAl4iGXRfWiBJDThGGi1SAlUiGT5LCyZWBicQDQ==';

console.log('Testing decoders on window[\'ZpQw9XkLmN8c3vR3\'] data:\n');

// Decoder 1: Simple base64
try {
  const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
  console.log('1. Simple base64:');
  console.log(`   Result: ${decoded.substring(0, 100)}`);
  if (decoded.includes('.m3u8') || decoded.includes('http')) {
    console.log('   ✅ CONTAINS M3U8/HTTP!');
  } else {
    console.log('   ❌ Binary/encrypted data');
  }
} catch (e) {
  console.log('1. Simple base64: Failed');
}
console.log('');

// Decoder 2: XOR with variable name
try {
  const key = 'ZpQw9XkLmN8c3vR3';
  const decoded = Buffer.from(encoded, 'base64');
  const result = [];
  for (let i = 0; i < decoded.length; i++) {
    result.push(decoded[i] ^ key.charCodeAt(i % key.length));
  }
  const text = Buffer.from(result).toString('utf-8');
  console.log('2. XOR with variable name:');
  console.log(`   Result: ${text.substring(0, 100)}`);
  if (text.includes('.m3u8') || text.includes('http')) {
    console.log('   ✅ CONTAINS M3U8/HTTP!');
  } else {
    console.log('   ❌ Still encrypted');
  }
} catch (e) {
  console.log('2. XOR with variable name: Failed');
}
console.log('');

// Decoder 3: Try common keys
const commonKeys = ['superembed', 'srcrcp', 'cloudnestra', 'vidsrc', 'player'];

commonKeys.forEach((key, i) => {
  try {
    const decoded = Buffer.from(encoded, 'base64');
    const result = [];
    for (let j = 0; j < decoded.length; j++) {
      result.push(decoded[j] ^ key.charCodeAt(j % key.length));
    }
    const text = Buffer.from(result).toString('utf-8');
    
    if (text.includes('.m3u8') || text.includes('http') || text.includes('://')) {
      console.log(`${i + 3}. XOR with '${key}': ✅ FOUND SOMETHING!`);
      console.log(`   Result: ${text}`);
    }
  } catch (e) {}
});

console.log('\n' + '='.repeat(80));
console.log('CONCLUSION');
console.log('='.repeat(80) + '\n');

console.log('The window[\'ZpQw9XkLmN8c3vR3\'] variable contains encrypted data.');
console.log('We need to either:');
console.log('A. Reverse engineer the 230KB decryption script');
console.log('B. Find the decryption key/algorithm');
console.log('C. Use Puppeteer to let JavaScript decrypt it\n');

console.log('Since you want PURE FETCH ONLY, we need option A or B.');
console.log('This requires analyzing the 230KB inline script to find the decryption logic.\n');
