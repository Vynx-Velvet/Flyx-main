/**
 * GET CURRENT HASH SCRIPT
 * Extract the current hash script to see the decoding logic
 */

const https = require('https');
const fs = require('fs');

async function getCurrentHashScript() {
  console.log('📥 Getting Current Hash Script\n');
  console.log('='.repeat(80) + '\n');
  
  const tmdbId = 550;
  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${tmdbId}`;
  
  const embedPage = await fetch(embedUrl);
  const hash = embedPage.match(/data-hash="([^"]+)"/)[1];
  
  const rcpUrl = `https://cloudnestra.com/rcp/${hash}`;
  const rcpPage = await fetch(rcpUrl, embedUrl);
  const prorcp = rcpPage.match(/\/prorcp\/([A-Za-z0-9+\/=\-_]+)/)[1];
  
  const playerUrl = `https://cloudnestra.com/prorcp/${prorcp}`;
  const playerPage = await fetch(playerUrl, rcpUrl);
  
  // Find the hash script
  const hashScriptMatch = playerPage.match(/src=["']([^"']+[a-f0-9]{32}\.js[^"']*)["']/);
  
  if (!hashScriptMatch) {
    console.log('❌ No hash script found in player page');
    console.log('Looking for any .js files...\n');
    
    const allScripts = playerPage.match(/src=["']([^"']+\.js[^"']*)["']/g);
    if (allScripts) {
      console.log(`Found ${allScripts.length} script tags:`);
      allScripts.forEach((s, i) => {
        console.log(`${i + 1}. ${s}`);
      });
    }
    return;
  }
  
  let hashScriptUrl = hashScriptMatch[1];
  if (!hashScriptUrl.startsWith('http')) {
    hashScriptUrl = `https://cloudnestra.com${hashScriptUrl}`;
  }
  
  console.log(`Hash script URL: ${hashScriptUrl}\n`);
  console.log('Fetching hash script...\n');
  
  const hashScript = await fetch(hashScriptUrl, 'https://cloudnestra.com/');
  
  console.log(`✅ Got hash script (${hashScript.length} bytes)\n`);
  
  // Save it
  fs.writeFileSync('deobfuscation/current-hash-script.js', hashScript);
  console.log('✅ Saved to deobfuscation/current-hash-script.js\n');
  
  // Look for decode functions
  console.log('Searching for decode patterns...\n');
  
  const patterns = [
    /function\s+(\w+)\s*\([^)]*\)\s*{[^}]*atob/g,
    /function\s+(\w+)\s*\([^)]*\)\s*{[^}]*fromCharCode/g,
    /function\s+(\w+)\s*\([^)]*\)\s*{[^}]*charCodeAt/g,
    /(\w+)\s*=\s*function\s*\([^)]*\)\s*{[^}]*decode/gi,
    /function\s+(\w+)\s*\([^)]*\)\s*{[^}]*replace.*shift/g
  ];
  
  patterns.forEach((pattern, i) => {
    const matches = [...hashScript.matchAll(pattern)];
    if (matches.length > 0) {
      console.log(`Pattern ${i + 1} found ${matches.length} matches:`);
      matches.slice(0, 3).forEach(m => {
        console.log(`  - ${m[0].substring(0, 100)}...`);
      });
      console.log('');
    }
  });
  
  // Look for the div ID usage
  console.log('Searching for div ID usage...\n');
  const divIdPattern = /getElementById\s*\(\s*["']([^"']+)["']\s*\)/g;
  const divMatches = [...hashScript.matchAll(divIdPattern)];
  if (divMatches.length > 0) {
    console.log(`Found ${divMatches.length} getElementById calls`);
  }
  
  // Look for innerHTML usage
  const innerHTMLPattern = /\.innerHTML/g;
  const innerHTMLMatches = [...hashScript.matchAll(innerHTMLPattern)];
  if (innerHTMLMatches.length > 0) {
    console.log(`Found ${innerHTMLMatches.length} innerHTML usages`);
  }
  
  console.log('\n✅ Check deobfuscation/current-hash-script.js for the full script');
}

function fetch(url, referer = 'https://vidsrc-embed.ru/') {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': referer,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

getCurrentHashScript();
