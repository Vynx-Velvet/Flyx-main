const fs = require('fs');

const html = fs.readFileSync('deobfuscation/superembed-vidsrc-page.html', 'utf-8');

console.log('🔍 ANALYZING SUPEREMBED HASHES\n');
console.log('='.repeat(80) + '\n');

// Look for all data-hash attributes
const hashPattern = /data-hash=["']([^"']+)["']/g;
const hashes = [...html.matchAll(hashPattern)];

console.log(`Found ${hashes.length} data-hash attributes:\n`);

hashes.forEach((match, i) => {
  const hash = match[1];
  const index = match.index;
  
  // Get context (200 chars before and after)
  const contextStart = Math.max(0, index - 200);
  const contextEnd = Math.min(html.length, index + 300);
  const context = html.substring(contextStart, contextEnd);
  
  console.log(`${i + 1}. Hash: ${hash.substring(0, 60)}...`);
  console.log(`   Length: ${hash.length}`);
  console.log(`   Context: ${context.replace(/\s+/g, ' ').substring(0, 200)}...\n`);
});

// Look for data-id attributes
console.log('\n' + '='.repeat(80));
console.log('Looking for data-id attributes:\n');

const idPattern = /data-id=["']([^"']+)["']/g;
const ids = [...html.matchAll(idPattern)];

console.log(`Found ${ids.length} data-id attributes:\n`);

ids.forEach((match, i) => {
  const id = match[1];
  const index = match.index;
  
  // Get context
  const contextStart = Math.max(0, index - 100);
  const contextEnd = Math.min(html.length, index + 200);
  const context = html.substring(contextStart, contextEnd);
  
  console.log(`${i + 1}. ID: ${id}`);
  console.log(`   Context: ${context.replace(/\s+/g, ' ').substring(0, 200)}...\n`);
});

// Look for server buttons/links
console.log('\n' + '='.repeat(80));
console.log('Looking for server elements:\n');

const serverPattern = /<[^>]*(server|embed|source)[^>]*>/gi;
const servers = [...html.matchAll(serverPattern)];

console.log(`Found ${servers.length} server-related elements (showing first 10):\n`);

servers.slice(0, 10).forEach((match, i) => {
  console.log(`${i + 1}. ${match[0].substring(0, 150)}...\n`);
});

// Look for superembed specifically
console.log('\n' + '='.repeat(80));
console.log('Looking for "superembed" mentions:\n');

const superembedPattern = /superembed[^<>]{0,200}/gi;
const superembedMatches = [...html.matchAll(superembedPattern)];

console.log(`Found ${superembedMatches.length} mentions:\n`);

superembedMatches.forEach((match, i) => {
  console.log(`${i + 1}. ${match[0]}\n`);
});
