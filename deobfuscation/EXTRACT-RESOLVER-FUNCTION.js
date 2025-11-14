/**
 * EXTRACT RESOLVER FUNCTION
 * 
 * Extract the actual function that resolves placeholders by analyzing
 * the innerHTML assignment pattern
 */

const https = require('https');
const fs = require('fs');

async function extractResolverFunction() {
  console.log('🎯 EXTRACTING RESOLVER FUNCTION\n');
  console.log('='.repeat(80) + '\n');
  
  const tmdbId = 550;
  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${tmdbId}`;
  
  try {
    // Get the player page
    const embedPage = await fetch(embedUrl);
    const hash = embedPage.match(/data-hash="([^"]+)"/)[1];
    
    const rcpUrl = `https://cloudnestra.com/rcp/${hash}`;
    const rcpPage = await fetch(rcpUrl, embedUrl);
    const prorcp = rcpPage.match(/\/prorcp\/([A-Za-z0-9+\/=\-_]+)/)[1];
    
    const playerUrl = `https://cloudnestra.com/prorcp/${prorcp}`;
    const playerPage = await fetch(playerUrl, rcpUrl);
    
    // Extract the hidden div info
    const hiddenDiv = playerPage.match(/<div[^>]+id="([^"]+)"[^>]+style="display:none;">([^<]+)<\/div>/);
    const divId = hiddenDiv[1];
    const encoded = hiddenDiv[2];
    
    console.log(`Hidden div ID: ${divId}`);
    console.log(`Encoded data: ${encoded.substring(0, 80)}...\n`);
    
    // Get the hash script
    const hashScriptMatch = playerPage.match(/src=["']([^"']+[a-f0-9]{32}\.js[^"']*)["']/);
    let hashScriptUrl = hashScriptMatch[1];
    if (!hashScriptUrl.startsWith('http')) {
      hashScriptUrl = `https://cloudnestra.com${hashScriptUrl}`;
    }
    
    console.log(`Fetching hash script: ${hashScriptUrl}\n`);
    const hashScript = await fetch(hashScriptUrl, 'https://cloudnestra.com/');
    
    // The key line from beautified script:
    // window[bMGyx71TzQLfdonN("laM1dAi3vO")] = laM1dAi3vO(document.getElementById(bMGyx71TzQLfdonN("laM1dAi3vO")).innerHTML);
    
    // This means:
    // 1. bMGyx71TzQLfdonN is a string decoder function
    // 2. laM1dAi3vO is the function that processes the innerHTML (decodes + resolves placeholders)
    // 3. The div ID is encoded with bMGyx71TzQLfdonN
    
    console.log('🔍 ANALYZING THE PATTERN:\n');
    console.log('Pattern found: window[decoder("X")] = processor(document.getElementById(decoder("X")).innerHTML);\n');
    
    // Find the decoder function name by searching for the div ID
    const divIdPattern = new RegExp(`["']${divId}["']`, 'g');
    const divIdMatches = [...hashScript.matchAll(divIdPattern)];
    
    console.log(`Found ${divIdMatches.length} occurrences of div ID "${divId}"\n`);
    
    // Find the context around the div ID usage
    const divIdIndex = hashScript.indexOf(`"${divId}"`);
    if (divIdIndex !== -1) {
      const contextStart = Math.max(0, divIdIndex - 500);
      const contextEnd = Math.min(hashScript.length, divIdIndex + 500);
      const context = hashScript.substring(contextStart, contextEnd);
      
      console.log('Context around div ID usage:');
      console.log(context);
      console.log('\n');
      
      // Extract function names from the context
      const functionPattern = /(\w+)\s*\(/g;
      const functions = [...context.matchAll(functionPattern)];
      
      console.log('Functions found in context:');
      const uniqueFunctions = [...new Set(functions.map(f => f[1]))];
      uniqueFunctions.forEach((func, i) => {
        console.log(`${i + 1}. ${func}`);
      });
      console.log('\n');
    }
    
    // Now let's find the actual processor function
    // It should take the innerHTML and return the processed URL
    console.log('🔍 SEARCHING FOR PROCESSOR FUNCTION:\n');
    
    // Look for the innerHTML assignment pattern
    const innerHTMLPattern = /(\w+)\s*=\s*(\w+)\s*\(\s*\w+\.getElementById\([^)]+\)\.innerHTML\s*\)/g;
    const innerHTMLMatches = [...hashScript.matchAll(innerHTMLPattern)];
    
    if (innerHTMLMatches.length > 0) {
      console.log(`Found ${innerHTMLMatches.length} innerHTML processing patterns:`);
      innerHTMLMatches.forEach((match, i) => {
        console.log(`${i + 1}. ${match[1]} = ${match[2]}(innerHTML)`);
      });
      console.log('\n');
      
      // The processor function is match[2]
      const processorName = innerHTMLMatches[0][2];
      console.log(`Processor function name: ${processorName}\n`);
      
      // Now find the definition of this function
      const funcDefPattern = new RegExp(`function\\s+${processorName}\\s*\\([^)]*\\)\\s*\\{[^}]{0,2000}\\}`, 'g');
      const funcDef = hashScript.match(funcDefPattern);
      
      if (funcDef) {
        console.log(`Found processor function definition:\n`);
        console.log(funcDef[0]);
        console.log('\n');
      } else {
        console.log(`Could not find function definition for ${processorName}\n`);
        
        // Try to find it as a variable assignment
        const varPattern = new RegExp(`(const|let|var)\\s+${processorName}\\s*=\\s*function[^}]{0,2000}\\}`, 'g');
        const varDef = hashScript.match(varPattern);
        
        if (varDef) {
          console.log(`Found as variable assignment:\n`);
          console.log(varDef[0]);
          console.log('\n');
        }
      }
    }
    
    // Alternative approach: Look for the pattern that replaces placeholders
    console.log('🔍 SEARCHING FOR PLACEHOLDER REPLACEMENT LOGIC:\n');
    
    // Look for .replace operations with {v1}, {v2}, etc.
    const replacePattern = /\.replace\s*\(\s*["']\{v\d+\}["']\s*,\s*([^)]+)\)/g;
    const replaceMatches = [...hashScript.matchAll(replacePattern)];
    
    if (replaceMatches.length > 0) {
      console.log(`✅ FOUND PLACEHOLDER REPLACEMENT!`);
      console.log(`Found ${replaceMatches.length} placeholder replacements:\n`);
      
      replaceMatches.forEach((match, i) => {
        console.log(`${i + 1}. .replace("{vX}", ${match[1]})`);
        
        // Extract more context
        const matchIndex = hashScript.indexOf(match[0]);
        const contextStart = Math.max(0, matchIndex - 200);
        const contextEnd = Math.min(hashScript.length, matchIndex + 200);
        const context = hashScript.substring(contextStart, contextEnd);
        
        console.log(`   Context: ${context}\n`);
      });
    } else {
      console.log('❌ No direct .replace("{vX}", ...) patterns found\n');
      console.log('The placeholders might be replaced using a different method\n');
    }
    
    // Look for array access patterns that might contain CDN mappings
    console.log('🔍 SEARCHING FOR CDN MAPPING ARRAYS:\n');
    
    const arrayAccessPattern = /\w+\[["']v\d+["']\]/g;
    const arrayAccess = [...hashScript.matchAll(arrayAccessPattern)];
    
    if (arrayAccess.length > 0) {
      console.log(`Found ${arrayAccess.length} array access patterns with v1/v2/v3/v4:`);
      arrayAccess.forEach((match, i) => {
        console.log(`${i + 1}. ${match[0]}`);
      });
    }
    
    console.log('\n✅ ANALYSIS COMPLETE\n');
    console.log('Next step: Manually trace the processor function to find the CDN mappings');
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    console.log(error.stack);
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

extractResolverFunction();
