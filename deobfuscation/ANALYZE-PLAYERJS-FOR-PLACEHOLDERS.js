/**
 * ANALYZE PLAYERJS FOR PLACEHOLDER RESOLUTION
 * 
 * The Playerjs library must contain the logic to resolve {v1}, {v2}, etc.
 * Let's fetch it and search for the resolution logic
 */

const https = require('https');
const fs = require('fs');

async function analyzePlayerjsForPlaceholders() {
  console.log('🔍 ANALYZING PLAYERJS FOR PLACEHOLDER RESOLUTION LOGIC\n');
  console.log('='.repeat(80) + '\n');
  
  try {
    const playerjsUrl = 'https://cloudnestra.com/pjs/pjs_main_drv_cast.061125.js?_=1762464381';
    
    console.log(`Fetching Playerjs from: ${playerjsUrl}\n`);
    const playerjs = await fetch(playerjsUrl);
    
    console.log(`✅ Got Playerjs (${playerjs.length} characters)\n`);
    
    // Save it
    fs.writeFileSync('deobfuscation/playerjs.js', playerjs);
    
    console.log('='.repeat(80));
    console.log('SEARCHING FOR PLACEHOLDER PATTERNS');
    console.log('='.repeat(80) + '\n');
    
    // Search for patterns related to {v1}, {v2}, etc.
    const patterns = [
      { name: 'Direct placeholder reference', regex: /\{v\d+\}/g },
      { name: 'Placeholder in string', regex: /["']\{v\d+\}["']/g },
      { name: 'Replace with v1/v2/v3/v4', regex: /replace\s*\([^)]*v\d+[^)]*\)/gi },
      { name: 'Object with v1/v2/v3/v4 keys', regex: /[{,]\s*["']?v\d+["']?\s*:/g },
      { name: 'Array with v1/v2/v3/v4', regex: /\[\s*["']v\d+["']/g },
      { name: 'CDN or domain mapping', regex: /(cdn|domain|server|host).*v\d+/gi },
      { name: 'URL construction with placeholders', regex: /(url|src|file).*\{.*\}/gi }
    ];
    
    const findings = {};
    
    for (const pattern of patterns) {
      const matches = [...playerjs.matchAll(pattern.regex)];
      if (matches.length > 0) {
        console.log(`✅ ${pattern.name}: Found ${matches.length} matches`);
        findings[pattern.name] = matches.map(m => m[0]);
        
        // Show first few matches
        matches.slice(0, 3).forEach((match, i) => {
          const index = playerjs.indexOf(match[0]);
          const contextStart = Math.max(0, index - 100);
          const contextEnd = Math.min(playerjs.length, index + match[0].length + 100);
          const context = playerjs.substring(contextStart, contextEnd);
          
          console.log(`\n  Match ${i + 1}:`);
          console.log(`  ${context.replace(/\n/g, ' ')}`);
        });
        console.log('');
      } else {
        console.log(`❌ ${pattern.name}: No matches`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('SEARCHING FOR DOMAIN/CDN ARRAYS');
    console.log('='.repeat(80) + '\n');
    
    // Look for arrays that might contain CDN domains
    const domainArrayPattern = /\[\s*["'][^"']+\.(com|net|io|org)["']\s*,\s*["'][^"']+\.(com|net|io|org)["']/g;
    const domainArrays = [...playerjs.matchAll(domainArrayPattern)];
    
    if (domainArrays.length > 0) {
      console.log(`Found ${domainArrays.length} potential CDN domain arrays:\n`);
      domainArrays.slice(0, 5).forEach((match, i) => {
        console.log(`${i + 1}. ${match[0]}`);
      });
    } else {
      console.log('No obvious domain arrays found');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('SEARCHING FOR STRING REPLACEMENT LOGIC');
    console.log('='.repeat(80) + '\n');
    
    // Look for functions that might do string replacement
    const replacePattern = /\.replace\s*\(\s*[^,]+\s*,\s*[^)]+\)/g;
    const replaceOps = [...playerjs.matchAll(replacePattern)];
    
    console.log(`Found ${replaceOps.length} replace operations\n`);
    
    // Look for replace operations that might handle placeholders
    const placeholderReplaces = replaceOps.filter(match => {
      const context = playerjs.substring(
        Math.max(0, playerjs.indexOf(match[0]) - 200),
        Math.min(playerjs.length, playerjs.indexOf(match[0]) + 200)
      );
      return context.includes('{') || context.includes('v1') || context.includes('v2');
    });
    
    if (placeholderReplaces.length > 0) {
      console.log(`✅ Found ${placeholderReplaces.length} replace operations near placeholder-related code:\n`);
      
      placeholderReplaces.slice(0, 5).forEach((match, i) => {
        const index = playerjs.indexOf(match[0]);
        const contextStart = Math.max(0, index - 150);
        const contextEnd = Math.min(playerjs.length, index + match[0].length + 150);
        const context = playerjs.substring(contextStart, contextEnd);
        
        console.log(`${i + 1}. ${context.replace(/\n/g, ' ').substring(0, 300)}...\n`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('SEARCHING FOR "OR" LOGIC (URL FALLBACKS)');
    console.log('='.repeat(80) + '\n');
    
    // The URL contains " or " separators, so the player might split on that
    const orPattern = /split\s*\(\s*["']\s*or\s*["']\s*\)/gi;
    const orMatches = [...playerjs.matchAll(orPattern)];
    
    if (orMatches.length > 0) {
      console.log(`✅ Found ${orMatches.length} split(" or ") operations!\n`);
      
      orMatches.forEach((match, i) => {
        const index = playerjs.indexOf(match[0]);
        const contextStart = Math.max(0, index - 200);
        const contextEnd = Math.min(playerjs.length, index + match[0].length + 200);
        const context = playerjs.substring(contextStart, contextEnd);
        
        console.log(`${i + 1}. Context:`);
        console.log(context.replace(/\n/g, ' '));
        console.log('');
      });
    } else {
      console.log('No split(" or ") found');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('MANUAL INSPECTION REQUIRED');
    console.log('='.repeat(80) + '\n');
    
    console.log('The Playerjs library is likely minified/obfuscated.');
    console.log('Saved to: deobfuscation/playerjs.js');
    console.log('\nNext steps:');
    console.log('1. Search the file for ".com", ".net", ".io" to find CDN domains');
    console.log('2. Look for functions that process the file URL');
    console.log('3. Find where it handles multiple URLs (the " or " separator)');
    
    // Try to find .com, .net, .io references
    console.log('\n' + '='.repeat(80));
    console.log('SEARCHING FOR TLD REFERENCES');
    console.log('='.repeat(80) + '\n');
    
    const tldPattern = /["']\.(com|net|io|org)["']/g;
    const tldMatches = [...playerjs.matchAll(tldPattern)];
    
    console.log(`Found ${tldMatches.length} TLD references`);
    
    if (tldMatches.length > 0 && tldMatches.length < 50) {
      console.log('\nTLD references:');
      const uniqueTLDs = [...new Set(tldMatches.map(m => m[0]))];
      uniqueTLDs.forEach(tld => {
        const count = tldMatches.filter(m => m[0] === tld).length;
        console.log(`  ${tld}: ${count} occurrences`);
        
        // Show context for first occurrence
        const firstMatch = tldMatches.find(m => m[0] === tld);
        const index = playerjs.indexOf(firstMatch[0]);
        const context = playerjs.substring(
          Math.max(0, index - 80),
          Math.min(playerjs.length, index + 80)
        );
        console.log(`    Context: ${context.replace(/\n/g, ' ')}`);
      });
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    console.log(error.stack);
  }
}

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://cloudnestra.com/',
        'Accept': '*/*'
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

analyzePlayerjsForPlaceholders();
