/**
 * SYSTEMATIC DEOBFUSCATOR
 * 
 * Step-by-step deobfuscation of the hash script
 */

const fs = require('fs');
const vm = require('vm');

console.log('🔓 SYSTEMATIC DEOBFUSCATION\n');
console.log('='.repeat(80) + '\n');

const script = fs.readFileSync('hash-script-full.js', 'utf8');

console.log(`Script size: ${script.length} bytes\n\n`);

// STEP 1: Extract the string array
console.log('STEP 1: EXTRACTING STRING ARRAY\n');
console.log('─'.repeat(80) + '\n');

const stringArrayMatch = script.match(/function _0x5292\(\)\{const _0x[a-f0-9]+=\[([^\]]+)\];/);
if (stringArrayMatch) {
  const arrayContent = stringArrayMatch[1];
  const strings = arrayContent.match(/'([^']+)'/g);
  
  console.log(`Found ${strings.length} strings in array\n`);
  
  // Save the string array
  const stringArray = strings.map(s => s.replace(/'/g, ''));
  fs.writeFileSync('string-array.json', JSON.stringify(stringArray, null, 2));
  console.log('✅ Saved to string-array.json\n\n');
  
  // Show first 50
  console.log('First 50 strings:');
  stringArray.slice(0, 50).forEach((s, i) => {
    console.log(`   ${i}: ${s}`);
  });
  console.log('\n\n');
}

// STEP 2: Find the _0x586c function (string array accessor)
console.log('STEP 2: FINDING STRING ACCESSOR FUNCTION\n');
console.log('─'.repeat(80) + '\n');

const accessorMatch = script.match(/function _0x586c\(_0x[a-f0-9]+,_0x[a-f0-9]+\)\{[^}]+return _0x[a-f0-9]+\[_0x[a-f0-9]+\];/);
if (accessorMatch) {
  console.log('Found accessor function:\n');
  console.log(accessorMatch[0]);
  console.log('\n\n');
}

// STEP 3: Find the two key functions
console.log('STEP 3: EXTRACTING KEY FUNCTIONS\n');
console.log('─'.repeat(80) + '\n');

// Extract bMGyx71TzQLfdonN
const bMGyx71TzQLfdonNStart = script.indexOf('function bMGyx71TzQLfdonN');
if (bMGyx71TzQLfdonNStart !== -1) {
  // Find the end of this function by counting braces
  let braceCount = 0;
  let inFunction = false;
  let endIndex = bMGyx71TzQLfdonNStart;
  
  for (let i = bMGyx71TzQLfdonNStart; i < script.length; i++) {
    if (script[i] === '{') {
      braceCount++;
      inFunction = true;
    } else if (script[i] === '}') {
      braceCount--;
      if (inFunction && braceCount === 0) {
        endIndex = i + 1;
        break;
      }
    }
  }
  
  const bMGyx71TzQLfdonNFunc = script.substring(bMGyx71TzQLfdonNStart, endIndex);
  fs.writeFileSync('bMGyx71TzQLfdonN-function.js', bMGyx71TzQLfdonNFunc);
  console.log('✅ Extracted bMGyx71TzQLfdonN function');
  console.log(`   Length: ${bMGyx71TzQLfdonNFunc.length} bytes`);
  console.log(`   First 500 chars:\n${bMGyx71TzQLfdonNFunc.substring(0, 500)}...\n\n`);
}

// Extract GTAxQyTyBx
const GTAxQyTyBxStart = script.indexOf('function GTAxQyTyBx');
if (GTAxQyTyBxStart !== -1) {
  let braceCount = 0;
  let inFunction = false;
  let endIndex = GTAxQyTyBxStart;
  
  for (let i = GTAxQyTyBxStart; i < script.length; i++) {
    if (script[i] === '{') {
      braceCount++;
      inFunction = true;
    } else if (script[i] === '}') {
      braceCount--;
      if (inFunction && braceCount === 0) {
        endIndex = i + 1;
        break;
      }
    }
  }
  
  const GTAxQyTyBxFunc = script.substring(GTAxQyTyBxStart, endIndex);
  fs.writeFileSync('GTAxQyTyBx-function.js', GTAxQyTyBxFunc);
  console.log('✅ Extracted GTAxQyTyBx function');
  console.log(`   Length: ${GTAxQyTyBxFunc.length} bytes`);
  console.log(`   First 500 chars:\n${GTAxQyTyBxFunc.substring(0, 500)}...\n\n`);
}

// STEP 4: Try to execute just the decoder functions
console.log('STEP 4: TESTING DECODER FUNCTIONS IN ISOLATION\n');
console.log('─'.repeat(80) + '\n');

try {
  // Create minimal sandbox with just what we need
  const sandbox = {
    _0x5292: null,
    _0x586c: null,
    atob: (str) => Buffer.from(str, 'base64').toString('binary'),
    String: String,
    console: console
  };
  
  // Extract and execute the string array function
  const stringArrayFuncMatch = script.match(/function _0x5292\(\)\{[\s\S]+?return _0x5292\(\);/);
  if (stringArrayFuncMatch) {
    vm.createContext(sandbox);
    vm.runInContext(stringArrayFuncMatch[0], sandbox);
    console.log('✅ String array function loaded\n');
  }
  
  // Extract and execute the accessor function
  const accessorFuncMatch = script.match(/function _0x586c\(_0x[a-f0-9]+,_0x[a-f0-9]+\)\{[\s\S]+?\n\}/);
  if (accessorFuncMatch) {
    vm.runInContext(accessorFuncMatch[0], sandbox);
    console.log('✅ Accessor function loaded\n');
  }
  
  // Now try to load the decoder functions
  const bMGyx71TzQLfdonNFunc = fs.readFileSync('bMGyx71TzQLfdonN-function.js', 'utf8');
  const GTAxQyTyBxFunc = fs.readFileSync('GTAxQyTyBx-function.js', 'utf8');
  
  vm.runInContext(bMGyx71TzQLfdonNFunc, sandbox);
  console.log('✅ bMGyx71TzQLfdonN function loaded\n');
  
  vm.runInContext(GTAxQyTyBxFunc, sandbox);
  console.log('✅ GTAxQyTyBx function loaded\n');
  
  // Test with the constant "GTAxQyTyBx"
  console.log('Testing bMGyx71TzQLfdonN("GTAxQyTyBx")...\n');
  const result = vm.runInContext('bMGyx71TzQLfdonN("GTAxQyTyBx")', sandbox);
  console.log(`Result: ${result}\n`);
  
  // This should give us the div ID pattern!
  
} catch (error) {
  console.log('❌ Error:', error.message);
  console.log('\nThis is expected - the functions likely depend on other obfuscated code\n');
}

console.log('\n✅ SYSTEMATIC DEOBFUSCATION COMPLETE\n');
console.log('Next: Manually trace through the extracted functions\n');
