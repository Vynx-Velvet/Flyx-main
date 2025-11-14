const fs = require('fs');

const html = fs.readFileSync('deobfuscation/superembed-player.html', 'utf-8');

console.log('🔍 ANALYZING SUPEREMBED PLAYER PAGE\n');
console.log('='.repeat(80) + '\n');

console.log(`Page length: ${html.length} bytes\n`);

// Look for hidden divs
console.log('Looking for hidden divs:\n');
const hiddenPattern = /<div[^>]*style=["'][^"']*display:\s*none[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
const hiddenDivs = [...html.matchAll(hiddenPattern)];

console.log(`Found ${hiddenDivs.length} hidden divs\n`);

hiddenDivs.forEach((match, i) => {
  const fullTag = match[0];
  const content = match[1].trim();
  
  // Extract ID if present
  const idMatch = fullTag.match(/id=["']([^"']+)["']/);
  const divId = idMatch ? idMatch[1] : 'no-id';
  
  console.log(`${i + 1}. ID: ${divId}`);
  console.log(`   Content length: ${content.length} chars`);
  console.log(`   Content preview: ${content.substring(0, 100)}...`);
  
  // Check if it looks like base64
  if (/^[A-Za-z0-9+/=\s]+$/.test(content) && content.length > 100) {
    console.log(`   ✅ Looks like base64!`);
  }
  console.log('');
});

// Alternative: look for divs with id and display:none in any order
console.log('\n' + '='.repeat(80));
console.log('Alternative search (id first, then style):\n');

const altPattern = /<div[^>]+id=["']([^"']+)["'][^>]*style=["'][^"']*display:\s*none[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
const altDivs = [...html.matchAll(altPattern)];

console.log(`Found ${altDivs.length} divs\n`);

altDivs.forEach((match, i) => {
  const divId = match[1];
  const content = match[2].trim();
  
  console.log(`${i + 1}. ID: ${divId}`);
  console.log(`   Content length: ${content.length} chars`);
  console.log(`   Content preview: ${content.substring(0, 100)}...`);
  
  if (/^[A-Za-z0-9+/=\s]+$/.test(content) && content.length > 100) {
    console.log(`   ✅ Looks like base64!`);
  }
  console.log('');
});

// Look for any div with long base64-like content
console.log('\n' + '='.repeat(80));
console.log('Looking for ANY div with base64-like content:\n');

const allDivs = [...html.matchAll(/<div[^>]*>([\s\S]*?)<\/div>/gi)];
console.log(`Total divs: ${allDivs.length}\n`);

let base64Divs = 0;
allDivs.forEach((match, i) => {
  const content = match[1].trim();
  
  if (/^[A-Za-z0-9+/=\s]+$/.test(content) && content.length > 500) {
    base64Divs++;
    const idMatch = match[0].match(/id=["']([^"']+)["']/);
    const divId = idMatch ? idMatch[1] : 'no-id';
    
    console.log(`Div ${i + 1}: ID=${divId}, Length=${content.length}`);
    console.log(`   Preview: ${content.substring(0, 80)}...`);
    console.log('');
  }
});

console.log(`Found ${base64Divs} divs with base64-like content\n`);
