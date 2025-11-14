/**
 * FIND CDN MAPPINGS IN PLAYER PAGE
 * 
 * The CDN mappings might be in the player page HTML or inline scripts
 */

const https = require('https');
const fs = require('fs');

async function findCDNInPlayerPage() {
  console.log('🔍 FINDING CDN MAPPINGS IN PLAYER PAGE\n');
  console.log('='.repeat(80) + '\n');
  
  try {
    const tmdbId = 550;
    const embedUrl = `https://vidsrc-embed.ru/embed/movie/${tmdbId}`;
    
    const embedPage = await fetch(embedUrl);
    const hash = embedPage.match(/data-hash="([^"]+)"/)[1];
    
    const rcpUrl = `https://cloudnestra.com/rcp/${hash}`;
    const rcpPage = await fetch(rcpUrl, embedUrl);
    const prorcp = rcpPage.match(/\/prorcp\/([A-Za-z0-9+\/=\-_]+)/)[1];
    
    const playerUrl = `https://cloudnestra.com/prorcp/${prorcp}`;
    const playerPage = await fetch(playerUrl, rcpUrl);
    
    // Save player page
    fs.writeFileSync('deobfuscation/player-page-for-cdn-analysis.html', playerPage);
    console.log('✅ Saved player page\n');
    
    // Search for CDN patterns
    console.log('Searching for CDN/placeholder patterns...\n');
    
    // Look for {v1}, {v2}, etc.
    const placeholderMatches = playerPage.match(/\{[vs]\d+\}/g);
    if (placeholderMatches) {
      console.log(`Found placeholders: ${[...new Set(placeholderMatches)].join(', ')}\n`);
    }
    
    // Look for inline scripts with CDN mappings
    const inlineScripts = playerPage.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
    if (inlineScripts) {
      console.log(`Found ${inlineScripts.length} inline scripts\n`);
      
      inlineScripts.forEach((script, i) => {
        // Check if script contains CDN/domain logic
        if (script.includes('v1') || script.includes('v2') || script.includes('cdn') || script.includes('stream')) {
          console.log(`\nInline Script ${i + 1} (contains CDN logic):`);
          console.log(script.substring(0, 500) + '...\n');
        }
      });
    }
    
    // Look for window object assignments
    const windowAssignments = playerPage.match(/window\[["']([^"']+)["']\]\s*=\s*["']([^"']+)["']/g);
    if (windowAssignments) {
      console.log(`\nFound ${windowAssignments.length} window assignments:\n`);
      windowAssignments.slice(0, 10).forEach(assignment => {
        console.log(`  ${assignment}`);
      });
    }
    
    // Look for data attributes with CDN info
    const dataAttrs = playerPage.match(/data-[a-z\-]+="[^"]*(?:cdn|stream|vip)[^"]*"/gi);
    if (dataAttrs) {
      console.log(`\nFound ${dataAttrs.length} data attributes with CDN info:\n`);
      dataAttrs.forEach(attr => {
        console.log(`  ${attr}`);
      });
    }
    
    // Look for JSON objects with CDN mappings
    const jsonObjects = playerPage.match(/\{[^}]*["']v\d["'][^}]*\}/g);
    if (jsonObjects) {
      console.log(`\nFound ${jsonObjects.length} JSON objects with v1/v2/v3/v4:\n`);
      jsonObjects.forEach(obj => {
        console.log(`  ${obj}`);
      });
    }
    
    console.log('\n✅ Check player-page-for-cdn-analysis.html for full page');
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
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

findCDNInPlayerPage();
