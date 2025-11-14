const fs = require('fs');

console.log('🔑 HUNTING FOR ENCRYPTION KEY\n');
console.log('='.repeat(80));

const playerPage = fs.readFileSync('player-page.html', 'utf8');

// Extract the hidden div ID and data
const hiddenDiv = playerPage.match(/<div[^>]+id="([^"]+)"[^>]+style="display:none;">([^<]+)<\/div>/);
const divId = hiddenDiv[1];
const encoded = hiddenDiv[2];

console.log(`\nHidden div ID: ${divId}`);
console.log(`Encoded length: ${encoded.length}\n`);

// The key might be:
// 1. In a data attribute
// 2. In a JavaScript variable
// 3. Derived from the div ID
// 4. In the cuid parameter
// 5. In the page body data attributes

console.log('1️⃣  Checking data attributes...\n');
const dataAttrs = playerPage.match(/data-[a-z]+="([^"]+)"/gi);
if (dataAttrs) {
  console.log(`Found ${dataAttrs.length} data attributes:\n`);
  dataAttrs.forEach(attr => console.log(`   ${attr}`));
}

console.log('\n2️⃣  Checking body attributes...\n');
const bodyMatch = playerPage.match(/<body[^>]*>/);
if (bodyMatch) {
  console.log(`   ${bodyMatch[0]}`);
}

console.log('\n3️⃣  Checking cuid parameter...\n');
const cuidMatch = playerPage.match(/cuid:\s*["']([^"']+)["']/);
if (cuidMatch) {
  console.log(`   cuid: ${cuidMatch[1]}`);
}

console.log('\n4️⃣  Searching for key/secret/salt variables...\n');
const keyVars = playerPage.match(/.{50}(?:key|secret|salt|pass)\s*[=:].{50}/gi);
if (keyVars) {
  console.log(`Found ${keyVars.length} potential key variables:\n`);
  keyVars.forEach((v, i) => console.log(`   ${i + 1}. ${v}\n`));
}

console.log('\n5️⃣  Checking inline script variables...\n');
const inlineScripts = playerPage.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
if (inlineScripts) {
  inlineScripts.forEach((script, i) => {
    const content = script.replace(/<\/?script[^>]*>/gi, '');
    
    // Look for var declarations with potential keys
    const vars = content.match(/var\s+\w+\s*=\s*["'][^"']{16,}["']/g);
    if (vars && vars.length < 20) {
      console.log(`\n   Script ${i + 1} variables (${vars.length}):`);
      vars.forEach(v => console.log(`      ${v}`));
    }
  });
}

console.log('\n6️⃣  Checking for base64 encoded keys...\n');
// Keys are often base64 encoded
const base64Patterns = playerPage.match(/["']([A-Za-z0-9+\/]{32,}={0,2})["']/g);
if (base64Patterns) {
  console.log(`Found ${base64Patterns.length} base64-like strings (first 10):\n`);
  base64Patterns.slice(0, 10).forEach((p, i) => {
    const decoded = Buffer.from(p.replace(/["']/g, ''), 'base64').toString('utf8');
    if (decoded.length >= 8 && decoded.length <= 64 && /^[\x20-\x7E]+$/.test(decoded)) {
      console.log(`   ${i + 1}. ${p} → ${decoded}`);
    }
  });
}

console.log('\n\n7️⃣  Checking the mysterious hash script...\n');
const hashScript = playerPage.match(/\/([a-f0-9]{32})\.js/);
if (hashScript) {
  console.log(`   Hash script: ${hashScript[0]}`);
  console.log(`   Hash: ${hashScript[1]}`);
  console.log(`   This might be the key or key derivation!`);
}

console.log('\n\n✅ KEY HUNT COMPLETE');
console.log('\nCheck the output above for potential keys to test');
