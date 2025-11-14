/**
 * NUCLEAR SUPEREMBED SEARCH
 * 
 * Exhaustive search for ANY source/server data
 */

const fs = require('fs');
const html = fs.readFileSync('deobfuscation/superembed-player.html', 'utf-8');

console.log('💣 NUCLEAR SEARCH FOR SUPEREMBED SOURCES\n');
console.log('='.repeat(80) + '\n');

// 1. Search for "sources" or "servers" as object keys
console.log('1. Searching for sources/servers as object keys:\n');

const objKeyPatterns = [
  /{[^}]{0,50}["']sources?["']\s*:\s*([^\n]{0,500})/gi,
  /{[^}]{0,50}["']servers?["']\s*:\s*([^\n]{0,500})/gi,
  /sources?\s*:\s*\[([^\]]{0,1000})\]/gi,
  /servers?\s*:\s*\[([^\]]{0,1000})\]/gi,
];

objKeyPatterns.forEach((pattern, i) => {
  const matches = [...html.matchAll(pattern)];
  if (matches.length > 0) {
    console.log(`Pattern ${i + 1}: ${matches.length} matches`);
    matches.forEach(m => {
      console.log(`  ${m[0].substring(0, 200)}`);
    });
    console.log('');
  }
});

// 2. Search for array of objects with url/file properties
console.log('2. Searching for arrays with url/file:\n');

const arrayPatterns = [
  /\[\s*{[^}]*["'](?:url|file|src)["']\s*:[^}]*}[^\]]*\]/gi,
];

arrayPatterns.forEach((pattern, i) => {
  const matches = [...html.matchAll(pattern)];
  if (matches.length > 0) {
    console.log(`Pattern ${i + 1}: ${matches.length} matches`);
    matches.slice(0, 5).forEach(m => {
      console.log(`  ${m[0].substring(0, 300)}`);
    });
    console.log('');
  }
});

// 3. Search for specific server names (common streaming servers)
console.log('3. Searching for server names:\n');

const serverNames = [
  'vidplay', 'filemoon', 'doodstream', 'streamtape', 'mixdrop',
  'upstream', 'voe', 'streamwish', 'mp4upload', 'server1', 'server2'
];

serverNames.forEach(name => {
  if (html.toLowerCase().includes(name)) {
    console.log(`  ✅ Found: ${name}`);
    
    // Get context
    const index = html.toLowerCase().indexOf(name);
    const context = html.substring(Math.max(0, index - 200), Math.min(html.length, index + 200));
    console.log(`     Context: ${context.replace(/\s+/g, ' ').substring(0, 150)}...\n`);
  }
});

// 4. Search for JSON-like structures
console.log('\n4. Searching for JSON structures:\n');

const jsonPattern = /{["'](?:name|label|server|source)["']\s*:\s*["'][^"']+["'][^}]{0,200}}/gi;
const jsonMatches = [...html.matchAll(jsonPattern)];

if (jsonMatches.length > 0) {
  console.log(`Found ${jsonMatches.length} JSON-like structures:`);
  jsonMatches.slice(0, 10).forEach((m, i) => {
    console.log(`${i + 1}. ${m[0].substring(0, 150)}`);
  });
  console.log('');
}

// 5. Look for the SrcRCP hash in the page (it might contain server info)
console.log('5. Looking for SrcRCP hash references:\n');

const srcrcpPattern = /srcrcp\/([A-Za-z0-9+/=]+)/gi;
const srcrcpMatches = [...html.matchAll(srcrcpPattern)];

if (srcrcpMatches.length > 0) {
  console.log(`Found ${srcrcpMatches.length} SrcRCP references:`);
  srcrcpMatches.forEach((m, i) => {
    const hash = m[1];
    console.log(`${i + 1}. Hash: ${hash.substring(0, 80)}...`);
    
    // Try to decode it
    try {
      const decoded = Buffer.from(hash, 'base64').toString('utf-8');
      console.log(`   Decoded: ${decoded.substring(0, 150)}`);
    } catch (e) {}
  });
  console.log('');
}

// 6. Look for window/global variable assignments with data
console.log('6. Looking for window variable assignments:\n');

const windowVarPattern = /window\[["']([^"']+)["']\]\s*=\s*({[^;]{100,500}})/gi;
const windowMatches = [...html.matchAll(windowVarPattern)];

if (windowMatches.length > 0) {
  console.log(`Found ${windowMatches.length} window assignments:`);
  windowMatches.forEach((m, i) => {
    console.log(`${i + 1}. window['${m[1]}']`);
    console.log(`   ${m[2].substring(0, 200)}...\n`);
    
    // Try to parse as JSON
    try {
      const obj = JSON.parse(m[2]);
      console.log(`   ✅ Parsed as JSON:`);
      console.log(`   Keys: ${Object.keys(obj).join(', ')}\n`);
    } catch (e) {}
  });
}

// 7. Look for data embedded in comments
console.log('7. Looking in HTML comments:\n');

const commentPattern = /<!--([\s\S]*?)-->/gi;
const comments = [...html.matchAll(commentPattern)];

console.log(`Found ${comments.length} comments`);
comments.forEach((m, i) => {
  const content = m[1].trim();
  if (content.length > 50 && (content.includes('source') || content.includes('server') || content.includes('http'))) {
    console.log(`${i + 1}. ${content.substring(0, 200)}`);
  }
});
console.log('');

// 8. Look for meta tags with data
console.log('8. Looking in meta tags:\n');

const metaPattern = /<meta[^>]+>/gi;
const metas = [...html.matchAll(metaPattern)];

console.log(`Found ${metas.length} meta tags`);
metas.forEach((m, i) => {
  const tag = m[0];
  if (tag.includes('source') || tag.includes('server') || tag.includes('data-')) {
    console.log(`${i + 1}. ${tag}`);
  }
});
console.log('');

// 9. Look for ANY long base64 strings that might be encoded source lists
console.log('9. Looking for long base64 strings:\n');

const longBase64Pattern = /["']([A-Za-z0-9+/]{200,}={0,2})["']/g;
const longBase64 = [...html.matchAll(longBase64Pattern)];

console.log(`Found ${longBase64.length} long base64 strings`);
longBase64.slice(0, 5).forEach((m, i) => {
  const encoded = m[1];
  console.log(`${i + 1}. Length: ${encoded.length}`);
  
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    console.log(`   Decoded preview: ${decoded.substring(0, 150)}`);
    
    // Check if it's JSON
    try {
      const obj = JSON.parse(decoded);
      console.log(`   ✅ It's JSON! Keys: ${Object.keys(obj).join(', ')}`);
    } catch (e) {}
  } catch (e) {
    console.log(`   ❌ Not valid base64`);
  }
  console.log('');
});

// 10. Final desperate search - look for ANYTHING that looks like a streaming URL
console.log('10. Searching for ANY streaming-like URLs:\n');

const streamUrlPattern = /https?:\/\/[^\s"'<>]+(?:\.m3u8|\/stream|\/source|\/play|\/embed|\/video)/gi;
const streamUrls = [...new Set([...html.matchAll(streamUrlPattern)].map(m => m[0]))];

if (streamUrls.length > 0) {
  console.log(`✅ Found ${streamUrls.length} streaming URLs:`);
  streamUrls.forEach(url => console.log(`  ${url}`));
} else {
  console.log('❌ No streaming URLs found');
}

console.log('\n' + '='.repeat(80));
console.log('SEARCH COMPLETE');
console.log('='.repeat(80));
