/**
 * EXTRACT COMPLETE DECODER
 * 
 * Extract the FULL decoder function with all dependencies
 */

const fs = require('fs');
const vm = require('vm');

console.log('🔧 EXTRACTING COMPLETE DECODER\n');
console.log('='.repeat(80) + '\n');

const script = fs.readFileSync('hash-script-full.js', 'utf8');

// We need to extract:
// 1. _0x5292 (string array)
// 2. _0x586c (string accessor)
// 3. GTAxQyTyBx (decoder)
// 4. bMGyx71TzQLfdonN (div ID decoder)

console.log('Creating minimal execution environment...\n');

// Create a sandbox with just what we need
const sandbox = {
  atob: (str) => Buffer.from(str, 'base64').toString('binary'),
  String: String,
  Buffer: Buffer,
  console: console,
  testDecode: null
};

// Extract the string array function
const stringArrayMatch = script.match(/function _0x5292\(\)\{const _0x[a-f0-9]+=\[[^\]]+\];_0x5292=function\(\)\{return _0x[a-f0-9]+;\};return _0x5292\(\);\}/);
if (stringArrayMatch) {
  console.log('✅ Found string array function\n');
  vm.createContext(sandbox);
  vm.runInContext(stringArrayMatch[0], sandbox);
}

// Extract the accessor function  
const accessorMatch = script.match(/function _0x586c\(_0x[a-f0-9]+,_0x[a-f0-9]+\)\{const _0x[a-f0-9]+=_0x5292\(\);return _0x586c=function\(_0x[a-f0-9]+,_0x[a-f0-9]+\)\{_0x[a-f0-9]+=_0x[a-f0-9]+-[^;]+;const _0x[a-f0-9]+=_0x[a-f0-9]+\[_0x[a-f0-9]+\];return _0x[a-f0-9]+;\},_0x586c\(_0x[a-f0-9]+,_0x[a-f0-9]+\);\}/);
if (accessorMatch) {
  console.log('✅ Found accessor function\n');
  vm.runInContext(accessorMatch[0], sandbox);
}

// Now extract GTAxQyTyBx
const GTAxQyTyBxFunc = fs.readFileSync('GTAxQyTyBx-function.js', 'utf8');
console.log('Loading GTAxQyTyBx function...\n');

try {
  vm.runInContext(GTAxQyTyBxFunc, sandbox);
  console.log('✅ GTAxQyTyBx loaded\n');
} catch (e) {
  console.log(`❌ Error loading GTAxQyTyBx: ${e.message}\n`);
}

// Test with sample data
console.log('Testing with sample encoded data...\n');

const testData = "U=IgHTBdFzV0PmQLG0LNKXIaKsF9MSOLABKFHUEQHBUBDTMTOfWhBTDQBII9VkUZBVKlPzVMBoBlFmVNLxDtY0SXZ3EUJTQNIHV9";

try {
  const result = vm.runInContext(`GTAxQyTyBx("${testData}")`, sandbox);
  console.log(`Result: ${result.substring(0, 200)}\n`);
  
  if (result.includes('http') || result.includes('.m3u8')) {
    console.log('🎉 IT WORKS!\n');
    console.log(result);
  }
} catch (e) {
  console.log(`❌ Error: ${e.message}\n`);
  console.log('The function has dependencies we haven\'t loaded yet.\n');
}

console.log('\n✅ EXTRACTION COMPLETE\n');
console.log('The decoder function requires the full obfuscated environment to run.\n');
console.log('This confirms that a pure fetch solution requires either:\n');
console.log('1. Fully deobfuscating and rewriting the decoder logic\n');
console.log('2. Running the obfuscated code in a VM (which we\'re trying)\n');
console.log('3. Using Puppeteer to execute in a real browser\n');
