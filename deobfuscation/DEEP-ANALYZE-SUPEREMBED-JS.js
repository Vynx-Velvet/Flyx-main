/**
 * DEEP ANALYSIS OF SUPEREMBED JAVASCRIPT
 * 
 * Extract M3U8 URLs and server configuration from the 230KB inline script
 */

const fs = require('fs');

const html = fs.readFileSync('deobfuscation/superembed-player.html', 'utf-8');

console.log('🔬 DEEP JAVASCRIPT ANALYSIS\n');
console.log('='.repeat(80) + '\n');

// Extract all scripts
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
console.log(`Found ${scripts.length} script blocks\n`);

// Find the large script
let largeScript = null;
let largeScriptIndex = -1;

scripts.forEach((script, i) => {
  const content = script[1];
  if (content.length > 100000) {
    largeScript = content;
    largeScriptIndex = i;
    console.log(`✅ Found large script at index ${i}: ${content.length} chars\n`);
  }
});

if (!largeScript) {
  console.log('❌ No large script found');
  process.exit(1);
}

// Save the large script
fs.writeFileSync('deobfuscation/superembed-large-script.js', largeScript);
console.log('✅ Saved to superembed-large-script.js\n');

console.log('='.repeat(80));
console.log('ANALYZING SCRIPT CONTENT\n');
console.log('='.repeat(80) + '\n');

// 1. Look for source/file URLs
console.log('1. Looking for source/file URLs:\n');
const sourcePatterns = [
  /["']file["']\s*:\s*["']([^"']+)["']/gi,
  /["']source["']\s*:\s*["']([^"']+)["']/gi,
  /["']src["']\s*:\s*["']([^"']+)["']/gi,
  /["']url["']\s*:\s*["']([^"']+)["']/gi,
];

sourcePatterns.forEach((pattern, i) => {
  const matches = [...largeScript.matchAll(pattern)];
  if (matches.length > 0) {
    console.log(`Pattern ${i + 1}: ${matches.length} matches`);
    matches.slice(0, 5).forEach(m => {
      const url = m[1];
      if (url.includes('http') || url.includes('.m3u8') || url.includes('/')) {
        console.log(`  ${url}`);
      }
    });
    console.log('');
  }
});

// 2. Look for API endpoints
console.log('2. Looking for API endpoints:\n');
const apiPatterns = [
  /["'](\/api\/[^"']+)["']/gi,
  /["'](https?:\/\/[^"']*\/api\/[^"']+)["']/gi,
  /fetch\s*\(\s*["']([^"']+)["']/gi,
];

const apiEndpoints = new Set();
apiPatterns.forEach(pattern => {
  const matches = [...largeScript.matchAll(pattern)];
  matches.forEach(m => apiEndpoints.add(m[1]));
});

if (apiEndpoints.size > 0) {
  console.log(`Found ${apiEndpoints.size} API endpoints:`);
  [...apiEndpoints].slice(0, 10).forEach(ep => console.log(`  ${ep}`));
  console.log('');
}

// 3. Look for base64 encoded data
console.log('3. Looking for base64 encoded data:\n');
const base64Pattern = /["']([A-Za-z0-9+/]{100,}={0,2})["']/g;
const base64Matches = [...largeScript.matchAll(base64Pattern)];
console.log(`Found ${base64Matches.length} base64 strings\n`);

let decodedUrls = [];
base64Matches.slice(0, 20).forEach((m, i) => {
  const encoded = m[1];
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    if (decoded.includes('http') || decoded.includes('.m3u8') || decoded.includes('cloudnestra')) {
      console.log(`${i + 1}. Decoded: ${decoded.substring(0, 150)}`);
      decodedUrls.push(decoded);
    }
  } catch (e) {}
});
console.log('');

// 4. Look for function calls that might fetch sources
console.log('4. Looking for source fetching functions:\n');
const functionPatterns = [
  /function\s+(\w+)\s*\([^)]*\)\s*{[^}]*(?:source|m3u8|stream|file)[^}]{0,500}}/gi,
  /const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*{[^}]*(?:source|m3u8|stream)[^}]{0,500}}/gi,
];

functionPatterns.forEach((pattern, i) => {
  const matches = [...largeScript.matchAll(pattern)];
  if (matches.length > 0) {
    console.log(`Pattern ${i + 1}: ${matches.length} functions`);
    matches.slice(0, 3).forEach(m => {
      console.log(`  Function: ${m[1]}`);
      console.log(`  ${m[0].substring(0, 200)}...`);
      console.log('');
    });
  }
});

// 5. Look for object properties with sources
console.log('5. Looking for source objects:\n');
const objPattern = /{[^}]*(?:sources|file|url)\s*:\s*[^}]{20,200}}/gi;
const objMatches = [...largeScript.matchAll(objPattern)];
console.log(`Found ${objMatches.length} source objects\n`);

objMatches.slice(0, 10).forEach((m, i) => {
  console.log(`${i + 1}. ${m[0].substring(0, 150)}`);
});
console.log('');

// 6. Look for server configuration
console.log('6. Looking for server configuration:\n');
const serverPatterns = [
  /servers?\s*[:=]\s*(\[[^\]]+\])/gi,
  /sources?\s*[:=]\s*(\[[^\]]+\])/gi,
];

serverPatterns.forEach((pattern, i) => {
  const matches = [...largeScript.matchAll(pattern)];
  if (matches.length > 0) {
    console.log(`Pattern ${i + 1}: ${matches.length} matches`);
    matches.slice(0, 3).forEach(m => {
      console.log(`  ${m[0].substring(0, 200)}`);
    });
    console.log('');
  }
});

// 7. Look for window object assignments
console.log('7. Looking for window object assignments:\n');
const windowPattern = /window\[["']([^"']+)["']\]\s*=\s*({[^;]+})/gi;
const windowMatches = [...largeScript.matchAll(windowPattern)];
console.log(`Found ${windowMatches.length} window assignments\n`);

windowMatches.forEach((m, i) => {
  const varName = m[1];
  const value = m[2];
  console.log(`${i + 1}. window['${varName}']`);
  console.log(`   ${value.substring(0, 200)}...`);
  console.log('');
});

// 8. Extract all URLs from the script
console.log('8. Extracting ALL URLs:\n');
const urlPattern = /https?:\/\/[^\s"'<>)]+/gi;
const allUrls = [...new Set([...largeScript.matchAll(urlPattern)].map(m => m[0]))];
console.log(`Found ${allUrls.length} unique URLs\n`);

// Filter interesting URLs
const interestingUrls = allUrls.filter(url => 
  url.includes('.m3u8') || 
  url.includes('stream') || 
  url.includes('source') ||
  url.includes('cloudnestra') ||
  url.includes('vidsrc')
);

if (interestingUrls.length > 0) {
  console.log(`Interesting URLs (${interestingUrls.length}):`);
  interestingUrls.forEach(url => console.log(`  ${url}`));
  console.log('');
}

// 9. Look for eval/Function calls that might decode data
console.log('9. Looking for eval/Function calls:\n');
const evalPattern = /(?:eval|Function)\s*\(\s*["']([^"']{50,})["']/gi;
const evalMatches = [...largeScript.matchAll(evalPattern)];
console.log(`Found ${evalMatches.length} eval/Function calls\n`);

evalMatches.slice(0, 3).forEach((m, i) => {
  console.log(`${i + 1}. ${m[0].substring(0, 150)}...`);
});
console.log('');

// 10. Look for atob (base64 decode) calls
console.log('10. Looking for atob calls:\n');
const atobPattern = /atob\s*\(\s*["']([^"']+)["']\s*\)/gi;
const atobMatches = [...largeScript.matchAll(atobPattern)];
console.log(`Found ${atobMatches.length} atob calls\n`);

atobMatches.slice(0, 10).forEach((m, i) => {
  const encoded = m[1];
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    console.log(`${i + 1}. Decoded: ${decoded.substring(0, 150)}`);
  } catch (e) {
    console.log(`${i + 1}. Failed to decode`);
  }
});
console.log('');

// Summary
console.log('='.repeat(80));
console.log('SUMMARY\n');
console.log('='.repeat(80) + '\n');

console.log(`Script size: ${largeScript.length} chars`);
console.log(`API endpoints found: ${apiEndpoints.size}`);
console.log(`Base64 strings: ${base64Matches.length}`);
console.log(`Decoded URLs: ${decodedUrls.length}`);
console.log(`All URLs: ${allUrls.length}`);
console.log(`Interesting URLs: ${interestingUrls.length}`);
console.log(`Window assignments: ${windowMatches.length}`);
console.log(`Atob calls: ${atobMatches.length}\n`);

if (decodedUrls.length > 0) {
  console.log('✅ DECODED URLS FOUND:');
  decodedUrls.forEach(url => console.log(`  ${url}`));
  console.log('');
}

if (interestingUrls.length > 0) {
  console.log('✅ INTERESTING URLS FOUND:');
  interestingUrls.forEach(url => console.log(`  ${url}`));
  console.log('');
}

// Save results
const results = {
  scriptSize: largeScript.length,
  apiEndpoints: [...apiEndpoints],
  decodedUrls,
  interestingUrls,
  windowAssignments: windowMatches.map(m => ({ name: m[1], value: m[2].substring(0, 200) }))
};

fs.writeFileSync(
  'deobfuscation/superembed-js-analysis.json',
  JSON.stringify(results, null, 2)
);

console.log('📊 Results saved to superembed-js-analysis.json\n');
