const fs = require('fs');

const html = fs.readFileSync('deobfuscation/superembed-vidsrc-page.html', 'utf-8');

console.log('🔍 EXTRACTING SUPEREMBED DATA\n');
console.log('='.repeat(80) + '\n');

// Look for window object assignments
const windowPattern = /window\['([^']+)'\]\s*=\s*({[\s\S]*?});/g;
const windowMatches = [...html.matchAll(windowPattern)];

console.log(`Found ${windowMatches.length} window object assignments:\n`);

windowMatches.forEach((match, i) => {
  const varName = match[1];
  const jsonStr = match[2];
  
  console.log(`${i + 1}. window['${varName}']`);
  console.log(`   Length: ${jsonStr.length} chars`);
  
  try {
    const data = JSON.parse(jsonStr);
    console.log(`   Parsed successfully!`);
    console.log(`   Keys: ${Object.keys(data).join(', ')}`);
    console.log(`   Data:`, JSON.stringify(data, null, 2).substring(0, 500));
  } catch (e) {
    console.log(`   Failed to parse: ${e.message}`);
    console.log(`   Raw (first 200 chars): ${jsonStr.substring(0, 200)}`);
  }
  console.log('');
});

// Look for data embedded in the page
console.log('\n' + '='.repeat(80));
console.log('Looking for embedded data structures:\n');

// Look for JSON-like structures
const jsonPattern = /{["'](?:servers|sources|hash|embed)[^}]{20,}}/gi;
const jsonMatches = [...html.matchAll(jsonPattern)];

console.log(`Found ${jsonMatches.length} JSON-like structures:\n`);

jsonMatches.slice(0, 5).forEach((match, i) => {
  console.log(`${i + 1}. ${match[0].substring(0, 200)}...\n`);
});

// Look for base64-encoded data
console.log('\n' + '='.repeat(80));
console.log('Looking for base64-encoded data:\n');

const base64Pattern = /["']([A-Za-z0-9+/]{100,}={0,2})["']/g;
const base64Matches = [...html.matchAll(base64Pattern)];

console.log(`Found ${base64Matches.length} potential base64 strings (showing first 5):\n`);

base64Matches.slice(0, 5).forEach((match, i) => {
  const encoded = match[1];
  console.log(`${i + 1}. Length: ${encoded.length}`);
  console.log(`   Encoded: ${encoded.substring(0, 80)}...`);
  
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    if (decoded.includes('http') || decoded.includes('.m3u8') || decoded.includes('embed')) {
      console.log(`   ✅ Decoded: ${decoded.substring(0, 100)}`);
    }
  } catch (e) {}
  console.log('');
});

// Look for the actual server selection mechanism
console.log('\n' + '='.repeat(80));
console.log('Looking for server selection code:\n');

const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
const scripts = [...html.matchAll(scriptPattern)];

scripts.forEach((match, i) => {
  const content = match[1];
  
  // Look for click handlers or server switching
  if (content.includes('click') && (content.includes('server') || content.includes('embed'))) {
    console.log(`Script ${i + 1} has server click handling:`);
    
    // Extract the relevant function
    const funcPattern = /function[^{]*{[\s\S]{100,500}}/g;
    const funcs = [...content.matchAll(funcPattern)];
    
    if (funcs.length > 0) {
      console.log(`  Found ${funcs.length} functions`);
      funcs.slice(0, 2).forEach((f, j) => {
        console.log(`  Function ${j + 1}: ${f[0].substring(0, 200)}...`);
      });
    }
    console.log('');
  }
});

// Look for iframe creation
console.log('\n' + '='.repeat(80));
console.log('Looking for iframe creation code:\n');

scripts.forEach((match, i) => {
  const content = match[1];
  
  if (content.includes('iframe') || content.includes('createElement')) {
    console.log(`Script ${i + 1} creates iframes:`);
    
    // Extract iframe-related lines
    const lines = content.split('\n');
    const iframeLines = lines.filter(line => 
      line.includes('iframe') || line.includes('src=') || line.includes('.src')
    );
    
    iframeLines.slice(0, 10).forEach(line => {
      console.log(`  ${line.trim().substring(0, 150)}`);
    });
    console.log('');
  }
});
