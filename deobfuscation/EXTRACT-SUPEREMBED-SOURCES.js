/**
 * EXTRACT SUPEREMBED SOURCES
 * 
 * Look for the actual source list and M3U8 URLs in ALL scripts
 */

const fs = require('fs');

const html = fs.readFileSync('deobfuscation/superembed-player.html', 'utf-8');

console.log('🔍 EXTRACTING SUPEREMBED SOURCES\n');
console.log('='.repeat(80) + '\n');

// Extract ALL scripts
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
console.log(`Total scripts: ${scripts.length}\n`);

// Analyze each script
scripts.forEach((script, i) => {
  const content = script[1].trim();
  
  if (content.length === 0) return;
  
  console.log(`\nSCRIPT ${i + 1} (${content.length} chars)`);
  console.log('-'.repeat(80));
  
  // Skip the huge ad script
  if (content.length > 100000) {
    console.log('⏭️  Skipping large ad script\n');
    return;
  }
  
  // Look for sources/servers
  if (content.includes('source') || content.includes('server') || content.includes('m3u8')) {
    console.log('✅ Contains source/server/m3u8 keywords\n');
    console.log(content.substring(0, 1000));
    console.log('\n...\n');
    
    // Save this script
    fs.writeFileSync(`deobfuscation/superembed-script-${i}.js`, content);
    console.log(`💾 Saved to superembed-script-${i}.js\n`);
  }
  
  // Look for specific patterns
  const patterns = [
    { name: 'sources array', regex: /sources\s*[:=]\s*\[([^\]]+)\]/gi },
    { name: 'servers array', regex: /servers\s*[:=]\s*\[([^\]]+)\]/gi },
    { name: 'file property', regex: /file\s*[:=]\s*["']([^"']+)["']/gi },
    { name: 'url property', regex: /url\s*[:=]\s*["']([^"']+)["']/gi },
    { name: 'm3u8 URL', regex: /https?:\/\/[^\s"']+\.m3u8[^\s"']*/gi },
  ];
  
  patterns.forEach(({ name, regex }) => {
    const matches = [...content.matchAll(regex)];
    if (matches.length > 0) {
      console.log(`\n📍 Found ${name}: ${matches.length} matches`);
      matches.forEach(m => {
        console.log(`   ${m[0].substring(0, 150)}`);
      });
    }
  });
});

// Look for sources in HTML (outside scripts)
console.log('\n\n' + '='.repeat(80));
console.log('LOOKING IN HTML (outside scripts)\n');
console.log('='.repeat(80) + '\n');

// Remove all scripts from HTML
let htmlOnly = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

// Look for data attributes
const dataPatterns = [
  /data-source=["']([^"']+)["']/gi,
  /data-file=["']([^"']+)["']/gi,
  /data-url=["']([^"']+)["']/gi,
  /data-servers=["']([^"']+)["']/gi,
];

dataPatterns.forEach((pattern, i) => {
  const matches = [...htmlOnly.matchAll(pattern)];
  if (matches.length > 0) {
    console.log(`Pattern ${i + 1}: ${matches.length} matches`);
    matches.forEach(m => console.log(`  ${m[0]}`));
    console.log('');
  }
});

// Look for iframes
console.log('Looking for iframes:\n');
const iframes = [...htmlOnly.matchAll(/<iframe[^>]*>/gi)];
console.log(`Found ${iframes.length} iframes\n`);
iframes.forEach((iframe, i) => {
  console.log(`${i + 1}. ${iframe[0]}`);
});
console.log('');

// Look for video elements
console.log('Looking for video elements:\n');
const videos = [...htmlOnly.matchAll(/<video[^>]*>/gi)];
console.log(`Found ${videos.length} video elements\n`);
videos.forEach((video, i) => {
  console.log(`${i + 1}. ${video[0]}`);
});
console.log('');

// Look for source elements
console.log('Looking for source elements:\n');
const sources = [...htmlOnly.matchAll(/<source[^>]*>/gi)];
console.log(`Found ${sources.length} source elements\n`);
sources.forEach((source, i) => {
  console.log(`${i + 1}. ${source[0]}`);
});
console.log('');

console.log('='.repeat(80));
console.log('ANALYSIS COMPLETE');
console.log('='.repeat(80));
