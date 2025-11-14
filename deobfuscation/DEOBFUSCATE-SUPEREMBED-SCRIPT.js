/**
 * DEOBFUSCATE SUPEREMBED SCRIPT
 * 
 * The 60KB obfuscated script must contain the source fetching logic
 */

const fs = require('fs');

const script = fs.readFileSync('deobfuscation/superembed-script-5.js', 'utf-8');

console.log('🔓 DEOBFUSCATING SUPEREMBED SCRIPT\n');
console.log('='.repeat(80) + '\n');

console.log(`Script length: ${script.length} chars\n`);

// This is a common obfuscation pattern with an array of strings
// Let's extract the string array
console.log('Step 1: Extracting string array...\n');

const arrayMatch = script.match(/var\s+_0x[a-f0-9]+\s*=\s*\[([^\]]+)\]/);

if (arrayMatch) {
  const arrayContent = arrayMatch[1];
  
  // Extract all strings
  const strings = [...arrayContent.matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]);
  
  console.log(`✅ Found ${strings.length} strings in array\n`);
  
  // Look for interesting strings
  console.log('Interesting strings:\n');
  
  strings.forEach((str, i) => {
    if (
      str.includes('http') ||
      str.includes('.m3u8') ||
      str.includes('source') ||
      str.includes('server') ||
      str.includes('api') ||
      str.includes('stream') ||
      str.includes('/') && str.length > 10
    ) {
      console.log(`${i}. ${str}`);
    }
  });
  
  // Save all strings
  fs.writeFileSync(
    'deobfuscation/superembed-strings.json',
    JSON.stringify(strings, null, 2)
  );
  
  console.log(`\n💾 Saved all ${strings.length} strings to superembed-strings.json\n`);
}

// Step 2: Look for function calls that might construct URLs
console.log('\nStep 2: Looking for URL construction...\n');

const urlConstructionPatterns = [
  /["']https?:\/\/[^"']+["']\s*\+/gi,
  /\+\s*["']\/[^"']+["']/gi,
];

urlConstructionPatterns.forEach((pattern, i) => {
  const matches = [...script.matchAll(pattern)];
  if (matches.length > 0) {
    console.log(`Pattern ${i + 1}: ${matches.length} matches`);
    matches.slice(0, 5).forEach(m => {
      console.log(`  ${m[0]}`);
    });
    console.log('');
  }
});

// Step 3: Look for the actual execution/mapping logic
console.log('Step 3: Looking for string mapping function...\n');

// Common pattern: function that maps indices to strings
const mappingFuncPattern = /function\s+(_0x[a-f0-9]+)\s*\([^)]+\)\s*{[^}]{50,500}}/gi;
const mappingFuncs = [...script.matchAll(mappingFuncPattern)];

console.log(`Found ${mappingFuncs.length} potential mapping functions\n`);

mappingFuncs.slice(0, 3).forEach((m, i) => {
  console.log(`Function ${i + 1}: ${m[1]}`);
  console.log(`${m[0].substring(0, 200)}...\n`);
});

// Step 4: Try to find where sources are actually set
console.log('Step 4: Looking for source assignment...\n');

const sourceAssignmentPatterns = [
  /sources?\s*=\s*[^;]{20,200}/gi,
  /\.sources?\s*=\s*[^;]{20,200}/gi,
  /["']sources?["']\s*:\s*[^,}]{20,200}/gi,
];

sourceAssignmentPatterns.forEach((pattern, i) => {
  const matches = [...script.matchAll(pattern)];
  if (matches.length > 0) {
    console.log(`Pattern ${i + 1}: ${matches.length} matches`);
    matches.forEach(m => {
      console.log(`  ${m[0]}`);
    });
    console.log('');
  }
});

// Step 5: Look for base64 decode operations
console.log('Step 5: Looking for base64 operations...\n');

const base64Patterns = [
  /atob\s*\([^)]+\)/gi,
  /fromCharCode/gi,
  /charCodeAt/gi,
];

base64Patterns.forEach((pattern, i) => {
  const matches = [...script.matchAll(pattern)];
  if (matches.length > 0) {
    console.log(`Pattern ${i + 1}: ${matches.length} occurrences`);
  }
});
console.log('');

// Step 6: Extract any hardcoded URLs or paths
console.log('Step 6: Extracting hardcoded URLs/paths...\n');

const hardcodedPattern = /["']([/a-zA-Z0-9._-]{15,})["']/g;
const hardcoded = [...new Set([...script.matchAll(hardcodedPattern)].map(m => m[1]))];

const interesting = hardcoded.filter(str => 
  str.includes('/') || 
  str.includes('api') || 
  str.includes('source') ||
  str.includes('stream')
);

if (interesting.length > 0) {
  console.log(`Found ${interesting.length} interesting paths:`);
  interesting.forEach(path => console.log(`  ${path}`));
} else {
  console.log('No interesting paths found');
}

console.log('\n' + '='.repeat(80));
console.log('DEOBFUSCATION ANALYSIS COMPLETE');
console.log('='.repeat(80));
console.log('\nThe script is heavily obfuscated.');
console.log('Sources are likely fetched dynamically or embedded in the main page.');
console.log('Superembed may require JavaScript execution to get sources.\n');
