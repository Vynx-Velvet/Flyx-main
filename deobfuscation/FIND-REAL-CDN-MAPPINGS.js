/**
 * FIND REAL CDN MAPPINGS
 * 
 * Reverse engineer the hash script to find the ACTUAL CDN domain mappings
 * for {v1}, {v2}, {v3}, {v4}, {s1}, etc.
 */

const https = require('https');
const fs = require('fs');

async function findRealCDNMappings() {
  console.log('🔍 FINDING REAL CDN MAPPINGS\n');
  console.log('='.repeat(80) + '\n');
  
  try {
    // Get the hash script
    const tmdbId = 550;
    const embedUrl = `https://vidsrc-embed.ru/embed/movie/${tmdbId}`;
    
    const embedPage = await fetch(embedUrl);
    const hash = embedPage.match(/data-hash="([^"]+)"/)[1];
    
    const rcpUrl = `https://cloudnestra.com/rcp/${hash}`;
    const rcpPage = await fetch(rcpUrl, embedUrl);
    const prorcp = rcpPage.match(/\/prorcp\/([A-Za-z0-9+\/=\-_]+)/)[1];
    
    const playerUrl = `https://cloudnestra.com/prorcp/${prorcp}`;
    const playerPage = await fetch(playerUrl, rcpUrl);
    
    // Extract hash script URL
    const hashScriptMatch = playerPage.match(/src=["']([^"']+[a-f0-9]{32}\.js[^"']*)["']/);
    let hashScriptUrl = hashScriptMatch[1];
    if (!hashScriptUrl.startsWith('http')) {
      hashScriptUrl = `https://cloudnestra.com${hashScriptUrl}`;
    }
    
    console.log(`Fetching hash script: ${hashScriptUrl}\n`);
    const hashScript = await fetch(hashScriptUrl, 'https://cloudnestra.com/');
    
    // Save the script for analysis
    fs.writeFileSync('deobfuscation/hash-script-for-cdn-analysis.js', hashScript);
    console.log('✅ Saved hash script\n');
    
    // Search for placeholder patterns
    console.log('Searching for placeholder/CDN patterns...\n');
    
    // Look for {v1}, {v2}, etc. replacement logic
    const patterns = [
      // Direct string replacements
      /\{v1\}['"]\s*[:=]\s*["']([^"']+)["']/g,
      /\{v2\}['"]\s*[:=]\s*["']([^"']+)["']/g,
      /\{v3\}['"]\s*[:=]\s*["']([^"']+)["']/g,
      /\{v4\}['"]\s*[:=]\s*["']([^"']+)["']/g,
      
      // Object/map patterns
      /["']\{v1\}["']\s*:\s*["']([^"']+)["']/g,
      /["']\{v2\}["']\s*:\s*["']([^"']+)["']/g,
      /["']\{v3\}["']\s*:\s*["']([^"']+)["']/g,
      /["']\{v4\}["']\s*:\s*["']([^"']+)["']/g,
      
      // Replace function patterns
      /replace\s*\(\s*["']\{v\d\}["']\s*,\s*["']([^"']+)["']\s*\)/g,
      /replace\s*\(\s*["']\{s\d\}["']\s*,\s*["']([^"']+)["']\s*\)/g,
      
      // Array/list patterns
      /\[\s*["']([^"']+\.(?:net|com|io|stream))["']/g,
      
      // Domain patterns
      /["']([a-z0-9\-]+\.(?:vipanicdn|vipstream|cdn\d*\.vidsrc)\.(?:net|com|io|stream))["']/g
    ];
    
    const foundMappings = new Set();
    
    for (const pattern of patterns) {
      const matches = [...hashScript.matchAll(pattern)];
      matches.forEach(match => {
        if (match[1]) {
          foundMappings.add(match[1]);
        }
      });
    }
    
    if (foundMappings.size > 0) {
      console.log(`✅ Found ${foundMappings.size} potential CDN domains:\n`);
      Array.from(foundMappings).forEach((domain, i) => {
        console.log(`${i + 1}. ${domain}`);
      });
    } else {
      console.log('❌ No direct CDN mappings found in script\n');
      console.log('The mappings might be obfuscated. Analyzing obfuscated patterns...\n');
      
      // Look for obfuscated string arrays
      const stringArrayMatch = hashScript.match(/const\s+\w+\s*=\s*\[([^\]]{500,})\]/);
      if (stringArrayMatch) {
        console.log('Found obfuscated string array. Extracting strings...\n');
        
        const strings = stringArrayMatch[1].match(/["']([^"']+)["']/g);
        if (strings) {
          const domains = strings
            .map(s => s.replace(/["']/g, ''))
            .filter(s => s.includes('.') && (s.includes('cdn') || s.includes('stream') || s.includes('vip')));
          
          if (domains.length > 0) {
            console.log(`✅ Found ${domains.length} CDN domains in obfuscated array:\n`);
            domains.forEach((domain, i) => {
              console.log(`${i + 1}. ${domain}`);
            });
          }
        }
      }
    }
    
    // Look for the actual replacement logic
    console.log('\n\nSearching for replacement function...\n');
    
    const replaceFunctions = [
      ...hashScript.matchAll(/function\s+(\w+)\s*\([^)]*\)\s*\{[^}]{0,500}replace[^}]{0,500}\}/g),
      ...hashScript.matchAll(/(\w+)\s*=\s*function\s*\([^)]*\)\s*\{[^}]{0,500}replace[^}]{0,500}\}/g),
      ...hashScript.matchAll(/(\w+)\s*=\s*\([^)]*\)\s*=>\s*\{[^}]{0,500}replace[^}]{0,500}\}/g)
    ];
    
    if (replaceFunctions.length > 0) {
      console.log(`✅ Found ${replaceFunctions.length} replacement functions\n`);
      replaceFunctions.slice(0, 3).forEach((match, i) => {
        console.log(`Function ${i + 1}:`);
        console.log(match[0].substring(0, 200) + '...\n');
      });
    }
    
    console.log('\n✅ Analysis complete. Check hash-script-for-cdn-analysis.js for full script.');
    
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

findRealCDNMappings();
