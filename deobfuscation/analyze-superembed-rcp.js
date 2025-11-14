const fs = require('fs');

const html = fs.readFileSync('deobfuscation/superembed-rcp.html', 'utf-8');

console.log('🔍 ANALYZING SUPEREMBED RCP PAGE\n');
console.log('='.repeat(80) + '\n');

// Look for srcrcp
console.log('Looking for srcrcp references:\n');
const srcrcpMatches = [...html.matchAll(/srcrcp[^\s"'<>]{0,100}/gi)];
srcrcpMatches.forEach((m, i) => {
  console.log(`${i + 1}. ${m[0]}`);
});
console.log('');

// Look for jQuery iframe creation
console.log('Looking for jQuery iframe creation:\n');
const jqueryMatches = [...html.matchAll(/\$\(['"]<iframe>['"]\)[^;]{0,200}/gi)];
jqueryMatches.forEach((m, i) => {
  console.log(`${i + 1}. ${m[0]}`);
});
console.log('');

// Look for .attr calls
console.log('Looking for .attr() calls:\n');
const attrMatches = [...html.matchAll(/\.attr\([^)]+\)/gi)];
attrMatches.slice(0, 10).forEach((m, i) => {
  console.log(`${i + 1}. ${m[0]}`);
});
console.log('');

// Look for base64 strings that might be URLs
console.log('Looking for base64 strings:\n');
const base64Matches = [...html.matchAll(/["']([A-Za-z0-9+/]{60,}={0,2})["']/g)];
console.log(`Found ${base64Matches.length} potential base64 strings\n`);
base64Matches.slice(0, 5).forEach((m, i) => {
  const encoded = m[1];
  console.log(`${i + 1}. Length: ${encoded.length}`);
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    if (decoded.includes('http') || decoded.includes('/')) {
      console.log(`   Decoded: ${decoded.substring(0, 100)}`);
    }
  } catch (e) {}
});
console.log('');

// Extract all script content
console.log('Extracting inline scripts:\n');
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
console.log(`Found ${scripts.length} script blocks\n`);

scripts.forEach((script, i) => {
  const content = script[1];
  if (content.includes('iframe') || content.includes('src') || content.includes('srcrcp')) {
    console.log(`Script ${i + 1} (${content.length} chars):`);
    console.log(content.substring(0, 500));
    console.log('...\n');
  }
});
