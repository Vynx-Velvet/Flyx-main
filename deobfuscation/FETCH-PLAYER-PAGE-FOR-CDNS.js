const https = require('https');
const fs = require('fs');

// Fetch the player page HTML to find CDN mappings
const url = 'https://vidsrc.xyz/embed/movie/tt0111161';

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('🔍 ANALYZING PLAYER PAGE HTML FOR CDN MAPPINGS\n');
    console.log('='.repeat(80) + '\n');
    
    // Look for v1, v2, v3, v4 in the HTML
    const v1Match = data.match(/v1["\s:=]+([^"',}\s]+)/);
    const v2Match = data.match(/v2["\s:=]+([^"',}\s]+)/);
    const v3Match = data.match(/v3["\s:=]+([^"',}\s]+)/);
    const v4Match = data.match(/v4["\s:=]+([^"',}\s]+)/);
    
    console.log('PLACEHOLDER MAPPINGS FOUND:');
    if (v1Match) console.log(`v1 = "${v1Match[1]}"`);
    if (v2Match) console.log(`v2 = "${v2Match[1]}"`);
    if (v3Match) console.log(`v3 = "${v3Match[1]}"`);
    if (v4Match) console.log(`v4 = "${v4Match[1]}"`);
    
    // Save the HTML for further analysis
    fs.writeFileSync('deobfuscation/player-page.html', data);
    console.log('\n✅ Saved player page HTML to player-page.html');
  });
}).on('error', err => console.error('Error:', err.message));
