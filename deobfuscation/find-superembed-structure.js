const fs = require('fs');

const html = fs.readFileSync('deobfuscation/superembed-vidsrc-page.html', 'utf-8');

console.log('🔍 FINDING SUPEREMBED STRUCTURE\n');
console.log('='.repeat(80) + '\n');

// Look for server dropdown menu
const serverMenuPattern = /<div[^>]*class="[^"]*dropdown-menu[^"]*servers[^"]*"[^>]*>([\s\S]*?)<\/div>/i;
const serverMenuMatch = html.match(serverMenuPattern);

if (serverMenuMatch) {
  console.log('✅ Found server dropdown menu\n');
  const menuContent = serverMenuMatch[1];
  
  // Extract all server buttons/links
  const serverPattern = /<a[^>]*>([\s\S]*?)<\/a>/gi;
  const servers = [...menuContent.matchAll(serverPattern)];
  
  console.log(`Found ${servers.length} server options:\n`);
  
  servers.forEach((match, i) => {
    const fullTag = match[0];
    console.log(`${i + 1}. ${fullTag.substring(0, 200)}\n`);
  });
}

// Look for any element with "superembed" in attributes
console.log('\n' + '='.repeat(80));
console.log('Looking for elements with superembed-related attributes:\n');

const patterns = [
  /data-[^=]*=["'][^"']*superembed[^"']*["']/gi,
  /<[^>]*superembed[^>]*>/gi,
  /href=["'][^"']*superembed[^"']*["']/gi
];

patterns.forEach((pattern, i) => {
  const matches = [...html.matchAll(pattern)];
  if (matches.length > 0) {
    console.log(`Pattern ${i + 1} found ${matches.length} matches:`);
    matches.forEach(m => console.log(`  ${m[0]}`));
    console.log('');
  }
});

// Look for all <a> tags in the page
console.log('\n' + '='.repeat(80));
console.log('Analyzing all <a> tags (first 20):\n');

const allLinksPattern = /<a[^>]+>[^<]*<\/a>/gi;
const allLinks = [...html.matchAll(allLinksPattern)];

console.log(`Found ${allLinks.length} total links\n`);

allLinks.slice(0, 20).forEach((match, i) => {
  console.log(`${i + 1}. ${match[0]}\n`);
});

// Look for JavaScript that might contain server data
console.log('\n' + '='.repeat(80));
console.log('Looking for server data in JavaScript:\n');

const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
const scripts = [...html.matchAll(scriptPattern)];

console.log(`Found ${scripts.length} script blocks\n`);

scripts.forEach((match, i) => {
  const content = match[1];
  
  // Look for server-related data
  if (content.includes('server') || content.includes('embed') || content.includes('hash')) {
    console.log(`Script ${i + 1} contains server/embed/hash references`);
    
    // Extract relevant lines
    const lines = content.split('\n');
    const relevantLines = lines.filter(line => 
      line.includes('server') || line.includes('embed') || line.includes('hash')
    );
    
    if (relevantLines.length > 0 && relevantLines.length < 50) {
      relevantLines.slice(0, 10).forEach(line => {
        console.log(`  ${line.trim().substring(0, 100)}`);
      });
    }
    console.log('');
  }
});
