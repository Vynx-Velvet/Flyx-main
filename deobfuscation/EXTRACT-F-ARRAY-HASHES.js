/**
 * EXTRACT F ARRAY HASHES FROM SUPEREMBED
 * 
 * The example HTML shows an array "f" with base64 encoded server hashes!
 */

const fs = require('fs');

// From the example HTML you provided
const fArray = [
  "d3d3LmNkbjRhZHMuY29tL25hL3hsdWRWdC90Ym9va2luZy5taW4uanM=",
  "ZDNnNW92Zm5nanc5YncuY2xvdWRmcm9udC5uZXQvb2Jvb2tpbmcubWluLmpz",
  "d3d3LnlnamZ6a3Jwci5jb20vbVQvWGZndlVVL3Rib29raW5nLm1pbi5qcw==",
  "d3d3Lm5keHR4eWplaG5vLmNvbS9jYm9va2luZy5taW4uanM="
];

console.log('🔍 DECODING F ARRAY HASHES\n');
console.log('='.repeat(80) + '\n');

console.log(`Found ${fArray.length} base64 encoded strings in array "f"\n`);

fArray.forEach((encoded, i) => {
  console.log(`${i + 1}. Encoded: ${encoded}`);
  
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    console.log(`   Decoded: ${decoded}`);
    
    // Check if it's a URL
    if (decoded.includes('.') && decoded.includes('/')) {
      console.log(`   ✅ Looks like a URL/path!`);
    }
  } catch (e) {
    console.log(`   ❌ Failed to decode: ${e.message}`);
  }
  console.log('');
});

// Now let's look for this pattern in the actual saved HTML
console.log('='.repeat(80));
console.log('SEARCHING FOR F ARRAY IN SAVED HTML\n');
console.log('='.repeat(80) + '\n');

try {
  const html = fs.readFileSync('deobfuscation/superembed-player.html', 'utf-8');
  
  // Look for the f array pattern
  const fArrayPattern = /f\s*=\s*\[([^\]]+)\]/;
  const match = html.match(fArrayPattern);
  
  if (match) {
    console.log('✅ Found f array in saved HTML!\n');
    console.log('Raw match:');
    console.log(match[0].substring(0, 500) + '...\n');
    
    // Extract all base64 strings from the array
    const base64Pattern = /"([A-Za-z0-9+/=]+)"/g;
    const strings = [...match[1].matchAll(base64Pattern)].map(m => m[1]);
    
    console.log(`Found ${strings.length} base64 strings in f array:\n`);
    
    strings.forEach((encoded, i) => {
      console.log(`${i + 1}. ${encoded.substring(0, 60)}...`);
      
      try {
        const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
        console.log(`   Decoded: ${decoded}`);
        
        // Check if it contains server/source/stream keywords
        if (decoded.includes('server') || decoded.includes('source') || decoded.includes('stream') || decoded.includes('rcp') || decoded.includes('srcrcp')) {
          console.log(`   🎯 CONTAINS SERVER KEYWORDS!`);
        }
      } catch (e) {}
      console.log('');
    });
    
  } else {
    console.log('❌ f array not found in saved HTML');
    
    // Try alternative patterns
    console.log('\nTrying alternative patterns...\n');
    
    const altPatterns = [
      /,f\s*=\s*\[/,
      /var\s+f\s*=\s*\[/,
      /let\s+f\s*=\s*\[/,
      /const\s+f\s*=\s*\[/
    ];
    
    altPatterns.forEach((pattern, i) => {
      if (pattern.test(html)) {
        console.log(`✅ Pattern ${i + 1} matches!`);
        const context = html.match(new RegExp(pattern.source + '[^\\]]{0,500}'));
        if (context) {
          console.log(`Context: ${context[0].substring(0, 200)}...\n`);
        }
      }
    });
  }
  
  // Also look for window['ZpQw9XkLmN8c3vR3'] which was in the example
  console.log('\n' + '='.repeat(80));
  console.log('LOOKING FOR WINDOW VARIABLE WITH ENCODED DATA\n');
  console.log('='.repeat(80) + '\n');
  
  const windowVarPattern = /window\['([^']+)'\]\s*=\s*'([A-Za-z0-9+/=]{100,})'/;
  const windowMatch = html.match(windowVarPattern);
  
  if (windowMatch) {
    const varName = windowMatch[1];
    const encoded = windowMatch[2];
    
    console.log(`✅ Found window['${varName}'] with ${encoded.length} char base64 string\n`);
    console.log(`Encoded (first 100 chars): ${encoded.substring(0, 100)}...\n`);
    
    try {
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
      console.log(`Decoded (first 500 chars):\n${decoded.substring(0, 500)}...\n`);
      
      // Try to parse as JSON
      try {
        const obj = JSON.parse(decoded);
        console.log('✅ It\'s JSON!');
        console.log('Keys:', Object.keys(obj));
        console.log('\nFull object:');
        console.log(JSON.stringify(obj, null, 2));
      } catch (e) {
        console.log('Not JSON, raw text');
      }
    } catch (e) {
      console.log(`Failed to decode: ${e.message}`);
    }
  }
  
} catch (e) {
  console.log(`Error reading file: ${e.message}`);
}

console.log('\n' + '='.repeat(80));
console.log('ANALYSIS COMPLETE');
console.log('='.repeat(80));
