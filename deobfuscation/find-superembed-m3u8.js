const fs = require('fs');

const html = fs.readFileSync('deobfuscation/superembed-player.html', 'utf-8');

console.log('🔍 FINDING SUPEREMBED M3U8 URL\n');
console.log('='.repeat(80) + '\n');

// Look for direct M3U8 URLs
console.log('1. Looking for direct .m3u8 URLs:\n');
const m3u8Pattern = /https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*/gi;
const m3u8Matches = [...html.matchAll(m3u8Pattern)];
console.log(`Found ${m3u8Matches.length} M3U8 URLs\n`);
m3u8Matches.forEach((m, i) => {
  console.log(`${i + 1}. ${m[0]}`);
});
console.log('');

// Look for player configuration
console.log('2. Looking for player configuration:\n');
const playerPatterns = [
  /file:\s*["']([^"']+)["']/gi,
  /sources:\s*\[([^\]]+)\]/gi,
  /source:\s*["']([^"']+)["']/gi,
  /url:\s*["']([^"']+)["']/gi
];

playerPatterns.forEach((pattern, i) => {
  const matches = [...html.matchAll(pattern)];
  if (matches.length > 0) {
    console.log(`Pattern ${i + 1}: ${matches.length} matches`);
    matches.slice(0, 3).forEach(m => {
      console.log(`  ${m[0].substring(0, 100)}`);
    });
    console.log('');
  }
});

// Look for base64 encoded data
console.log('3. Looking for base64 encoded data:\n');
const base64Pattern = /["']([A-Za-z0-9+/]{100,}={0,2})["']/g;
const base64Matches = [...html.matchAll(base64Pattern)];
console.log(`Found ${base64Matches.length} potential base64 strings\n`);

base64Matches.slice(0, 5).forEach((m, i) => {
  const encoded = m[1];
  console.log(`${i + 1}. Length: ${encoded.length}`);
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    if (decoded.includes('http') || decoded.includes('.m3u8')) {
      console.log(`   ✅ Decoded: ${decoded.substring(0, 150)}`);
    }
  } catch (e) {}
});
console.log('');

// Look for variable assignments with URLs
console.log('4. Looking for variable assignments:\n');
const varPattern = /var\s+(\w+)\s*=\s*["']([^"']{50,})["']/g;
const varMatches = [...html.matchAll(varPattern)];
console.log(`Found ${varMatches.length} variable assignments\n`);

varMatches.slice(0, 10).forEach((m, i) => {
  const varName = m[1];
  const value = m[2];
  if (value.includes('http') || value.includes('/') || /^[A-Za-z0-9+/=]+$/.test(value)) {
    console.log(`${i + 1}. var ${varName} = "${value.substring(0, 80)}..."`);
  }
});
console.log('');

// Look for fetch/ajax calls
console.log('5. Looking for fetch/ajax calls:\n');
const fetchPattern = /fetch\s*\(\s*["']([^"']+)["']/gi;
const fetchMatches = [...html.matchAll(fetchPattern)];
console.log(`Found ${fetchMatches.length} fetch calls\n`);

fetchMatches.forEach((m, i) => {
  console.log(`${i + 1}. ${m[1]}`);
});
console.log('');

// Look for API endpoints
console.log('6. Looking for API endpoints:\n');
const apiPattern = /["'](\/api\/[^"']+)["']/gi;
const apiMatches = [...html.matchAll(apiPattern)];
console.log(`Found ${apiMatches.length} API endpoints\n`);

apiMatches.forEach((m, i) => {
  console.log(`${i + 1}. ${m[1]}`);
});
console.log('');

// Extract all script content for analysis
console.log('7. Extracting inline scripts:\n');
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
console.log(`Found ${scripts.length} script blocks\n`);

let relevantScripts = 0;
scripts.forEach((script, i) => {
  const content = script[1];
  if (content.includes('m3u8') || content.includes('source') || content.includes('file') || content.includes('player')) {
    relevantScripts++;
    console.log(`Script ${i + 1} (${content.length} chars) - Contains relevant keywords`);
    console.log(content.substring(0, 300));
    console.log('...\n');
  }
});

console.log(`Found ${relevantScripts} relevant scripts\n`);
