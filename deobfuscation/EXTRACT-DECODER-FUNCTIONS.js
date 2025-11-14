/**
 * EXTRACT THE DECODER FUNCTIONS
 * 
 * We found the key line:
 * window[bMGyx71TzQLfdonN("GTAxQyTyBx")] = GTAxQyTyBx(document.getElementById(bMGyx71TzQLfdonN("GTAxQyTyBx")).innerHTML);
 * 
 * Now we need to extract:
 * 1. bMGyx71TzQLfdonN - converts "GTAxQyTyBx" to the actual div ID
 * 2. GTAxQyTyBx - decrypts the encoded data
 */

const fs = require('fs');

console.log('🔍 EXTRACTING DECODER FUNCTIONS\n');
console.log('='.repeat(80) + '\n');

const script = fs.readFileSync('hash-script-full.js', 'utf8');

// Find the bMGyx71TzQLfdonN function
console.log('1️⃣  Looking for bMGyx71TzQLfdonN function...\n');

const bMGyx71TzQLfdonNMatch = script.match(/function\s+bMGyx71TzQLfdonN\s*\([^)]*\)\s*\{[^}]+\}/);
if (bMGyx71TzQLfdonNMatch) {
  console.log('✅ Found bMGyx71TzQLfdonN:\n');
  console.log(bMGyx71TzQLfdonNMatch[0]);
  console.log('\n');
} else {
  console.log('❌ Not found as regular function. Looking for variable assignment...\n');
  
  const varMatch = script.match(/(?:var|const|let)\s+bMGyx71TzQLfdonN\s*=\s*function\s*\([^)]*\)\s*\{[\s\S]{0,500}\}/);
  if (varMatch) {
    console.log('✅ Found as variable:\n');
    console.log(varMatch[0]);
    console.log('\n');
  }
}

// Find the GTAxQyTyBx function
console.log('\n2️⃣  Looking for GTAxQyTyBx function...\n');

const GTAxQyTyBxMatch = script.match(/function\s+GTAxQyTyBx\s*\([^)]*\)\s*\{[^}]+\}/);
if (GTAxQyTyBxMatch) {
  console.log('✅ Found GTAxQyTyBx:\n');
  console.log(GTAxQyTyBxMatch[0]);
  console.log('\n');
} else {
  console.log('❌ Not found as regular function. Looking for variable assignment...\n');
  
  const varMatch = script.match(/(?:var|const|let)\s+GTAxQyTyBx\s*=\s*function\s*\([^)]*\)\s*\{[\s\S]{0,1000}\}/);
  if (varMatch) {
    console.log('✅ Found as variable:\n');
    console.log(varMatch[0].substring(0, 500));
    if (varMatch[0].length > 500) console.log('...[truncated]');
    console.log('\n');
  }
}

// Look for the context around the key line
console.log('\n3️⃣  Context around the key line...\n');

const keyLineIndex = script.indexOf('window[bMGyx71TzQLfdonN("GTAxQyTyBx")]');
if (keyLineIndex !== -1) {
  const context = script.substring(Math.max(0, keyLineIndex - 1000), Math.min(script.length, keyLineIndex + 500));
  console.log(context);
}

console.log('\n\n✅ EXTRACTION COMPLETE\n');
