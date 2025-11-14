/**
 * DEEP ANALYZE THE HASH SCRIPT
 * 
 * This MUST contain the decryption logic that sets the div ID variable
 */

const https = require('https');
const fs = require('fs');

async function deepAnalyze() {
  console.log('🔐 DEEP ANALYSIS OF HASH SCRIPT\n');
  console.log('='.repeat(80) + '\n');
  
  // Get the hash script URL from a fresh page
  const vidsrc = await fetch('https://vidsrc-embed.ru/embed/movie/550');
  const hash = vidsrc.match(/data-hash="([^"]+)"/)[1];
  
  const rcp = await fetch(`https://cloudnestra.com/rcp/${hash}`, 'https://vidsrc-embed.ru/');
  const prorcp = rcp.match(/src:\s*['"]\/prorcp\/([^'"]+)['"]/)[1];
  
  const player = await fetch(`https://cloudnestra.com/prorcp/${prorcp}`, 'https://cloudnestra.com/');
  
  // Get the div ID
  const hiddenDiv = player.match(/<div[^>]+id="([^"]+)"[^>]+style="display:none;">([^<]+)<\/div>/);
  const divId = hiddenDiv[1];
  const encoded = hiddenDiv[2];
  
  console.log(`🎯 Target Div ID: ${divId}`);
  console.log(`📦 Encoded Data: ${encoded.substring(0, 100)}...\n\n`);
  
  // Get the hash script
  const hashScriptMatch = player.match(/src=["']([^"']+[a-f0-9]{32}\.js[^"']*)["']/);
  if (!hashScriptMatch) {
    console.log('❌ Could not find hash script in page');
    console.log('\nAll script tags:');
    const allScripts = player.match(/<script[^>]*src=["']([^"']+)["']/gi);
    if (allScripts) {
      allScripts.forEach(s => console.log(`   ${s}`));
    }
    return;
  }
  
  let hashScriptUrl = hashScriptMatch[1];
  if (!hashScriptUrl.startsWith('http')) {
    hashScriptUrl = `https://cloudnestra.com${hashScriptUrl}`;
  }
  
  console.log(`📜 Hash Script: ${hashScriptUrl}\n`);
  
  const hashScript = await fetch(hashScriptUrl, 'https://cloudnestra.com/');
  
  fs.writeFileSync('hash-script-full.js', hashScript);
  console.log(`✅ Downloaded ${hashScript.length} bytes\n\n`);
  
  // CRITICAL: Look for where the div ID variable gets set
  console.log('🔍 SEARCHING FOR DIV ID VARIABLE ASSIGNMENT...\n');
  console.log('─'.repeat(80) + '\n');
  
  // The script must contain code that does: window[divId] = decryptedValue
  // or: var divId = decryptedValue
  
  const patterns = [
    // Direct assignment
    new RegExp(`${divId}\\s*=`, 'g'),
    new RegExp(`window\\["${divId}"\\]`, 'g'),
    new RegExp(`window\\['${divId}'\\]`, 'g'),
    
    // Dynamic assignment
    /getElementById\([^)]+\)\.textContent/gi,
    /getElementById\([^)]+\)\.innerHTML/gi,
    /getElementById\([^)]+\)\.innerText/gi,
    
    // Window property assignment
    /window\[["'][^"']+["']\]\s*=/gi,
    
    // Variable declaration with getElementById
    /var\s+\w+\s*=\s*document\.getElementById/gi
  ];
  
  let foundAssignment = false;
  
  patterns.forEach((pattern, i) => {
    const matches = hashScript.match(pattern);
    if (matches) {
      console.log(`\n✅ Pattern ${i + 1} matched (${matches.length} times):`);
      console.log(`   Pattern: ${pattern}\n`);
      
      // Show context around each match
      matches.slice(0, 3).forEach((match, j) => {
        const index = hashScript.indexOf(match);
        const context = hashScript.substring(Math.max(0, index - 200), Math.min(hashScript.length, index + 200));
        console.log(`   Match ${j + 1} context:`);
        console.log(`   ${context}\n`);
      });
      
      foundAssignment = true;
    }
  });
  
  if (!foundAssignment) {
    console.log('❌ No direct assignment found. The script might use eval or Function constructor.\n');
  }
  
  // Look for the actual decryption function
  console.log('\n\n🔐 LOOKING FOR DECRYPTION LOGIC...\n');
  console.log('─'.repeat(80) + '\n');
  
  // Common decryption patterns
  const decryptPatterns = [
    /atob\([^)]+\)/gi,
    /fromCharCode/gi,
    /String\.fromCharCode/gi,
    /parseInt\([^)]+,\s*16\)/gi,
    /\.split\([^)]*\)\.reverse\(\)/gi,
    /\.replace\(/gi
  ];
  
  decryptPatterns.forEach(pattern => {
    const matches = hashScript.match(pattern);
    if (matches) {
      console.log(`\n${pattern}: ${matches.length} matches`);
      
      if (matches.length < 20) {
        // Show context for each
        matches.forEach((match, i) => {
          const index = hashScript.indexOf(match);
          const context = hashScript.substring(Math.max(0, index - 100), Math.min(hashScript.length, index + 100));
          console.log(`\n   ${i + 1}. ${context}`);
        });
      }
    }
  });
  
  // Try to find the main execution function
  console.log('\n\n🎯 LOOKING FOR MAIN EXECUTION...\n');
  console.log('─'.repeat(80) + '\n');
  
  // Look for IIFE or document.ready
  const iifeMatch = hashScript.match(/\(function\s*\([^)]*\)\s*\{[\s\S]{200,500}\}\s*\([^)]*\)\)/g);
  if (iifeMatch) {
    console.log(`Found ${iifeMatch.length} IIFE patterns (first 2):\n`);
    iifeMatch.slice(0, 2).forEach((iife, i) => {
      console.log(`\n${i + 1}. ${iife.substring(0, 300)}...\n`);
    });
  }
  
  // Look for document ready
  const readyMatch = hashScript.match(/\$\(document\)\.ready\([^}]+\}/g);
  if (readyMatch) {
    console.log(`\nFound ${readyMatch.length} document.ready patterns:\n`);
    readyMatch.forEach((ready, i) => {
      console.log(`\n${i + 1}. ${ready}\n`);
    });
  }
  
  console.log('\n\n✅ DEEP ANALYSIS COMPLETE\n');
  console.log('The decryption logic is in hash-script-full.js');
  console.log('Next step: Manually trace the execution or use a deobfuscator\n');
}

function fetch(url, referer = 'https://vidsrc-embed.ru/') {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': referer
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

deepAnalyze().catch(console.error);
