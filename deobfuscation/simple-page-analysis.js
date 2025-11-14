const fs = require('fs');
const html = fs.readFileSync('deobfuscation/superembed-vidsrc-page.html', 'utf-8');

console.log('Page length:', html.length);
console.log('');

// Check if this is actually a player page or an embed selector page
if (html.includes('id="player"') || html.includes('class="player"')) {
  console.log('✅ This appears to be a PLAYER page');
} else if (html.includes('servers') || html.includes('dropdown')) {
  console.log('✅ This appears to be a SERVER SELECTION page');
} else {
  console.log('⚠️  Unknown page type');
}

console.log('');

// Look for how servers are loaded
if (html.includes('fetch') && html.includes('server')) {
  console.log('✅ Page uses fetch() to load servers dynamically');
}

// Check for AJAX/API calls
const apiPattern = /["'](\/api\/[^"']+)["']/g;
const apis = [...html.matchAll(apiPattern)];
if (apis.length > 0) {
  console.log(`\n✅ Found ${apis.length} API endpoints:`);
  apis.forEach(m => console.log(`   ${m[1]}`));
}

// Check for data attributes that might contain IDs
const dataIdMatch = html.match(/data-id=["'](\d+)["']/);
if (dataIdMatch) {
  console.log(`\n✅ Found data-id: ${dataIdMatch[1]}`);
  console.log('   This might be the content ID for API calls');
}

// Look for JavaScript that loads servers
const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
const scripts = [...html.matchAll(scriptPattern)];

console.log(`\n📜 Found ${scripts.length} script blocks`);

// Check if servers are loaded via JavaScript
scripts.forEach((match, i) => {
  const content = match[1];
  if (content.includes('server') && content.includes('fetch')) {
    console.log(`\n✅ Script ${i + 1} loads servers dynamically`);
    
    // Extract the fetch URL
    const fetchPattern = /fetch\s*\(\s*["']([^"']+)["']/g;
    const fetches = [...content.matchAll(fetchPattern)];
    if (fetches.length > 0) {
      console.log('   Fetch URLs:');
      fetches.forEach(f => console.log(`     ${f[1]}`));
    }
  }
});

console.log('\n' + '='.repeat(80));
console.log('CONCLUSION:');
console.log('='.repeat(80));

if (dataIdMatch) {
  console.log(`\nThe page uses content ID: ${dataIdMatch[1]}`);
  console.log('Servers are likely loaded via an API call using this ID.');
  console.log('\nNext step: Find the API endpoint that returns server hashes.');
} else {
  console.log('\nCould not determine how servers are loaded.');
}
