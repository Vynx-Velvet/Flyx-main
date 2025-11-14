/**
 * EXTRACT PLACEHOLDER RESOLVER
 * 
 * Reverse engineer the actual JavaScript function that resolves {v1}, {v2}, etc.
 * by analyzing the hash script's execution logic
 */

const https = require('https');
const fs = require('fs');

async function extractPlaceholderResolver() {
  console.log('🔬 EXTRACTING PLACEHOLDER RESOLVER LOGIC\n');
  console.log('='.repeat(80) + '\n');
  
  const tmdbId = 550;
  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${tmdbId}`;
  
  try {
    // Get the player page with the hash script
    const embedPage = await fetch(embedUrl);
    const hash = embedPage.match(/data-hash="([^"]+)"/)[1];
    
    const rcpUrl = `https://cloudnestra.com/rcp/${hash}`;
    const rcpPage = await fetch(rcpUrl, embedUrl);
    const prorcp = rcpPage.match(/\/prorcp\/([A-Za-z0-9+\/=\-_]+)/)[1];
    
    const playerUrl = `https://cloudnestra.com/prorcp/${prorcp}`;
    const playerPage = await fetch(playerUrl, rcpUrl);
    
    // Save player page for reference
    fs.writeFileSync('deobfuscation/current-player-page.html', playerPage);
    
    // Extract the hash script URL
    const hashScriptMatch = playerPage.match(/src=["']([^"']+[a-f0-9]{32}\.js[^"']*)["']/);
    let hashScriptUrl = hashScriptMatch[1];
    if (!hashScriptUrl.startsWith('http')) {
      hashScriptUrl = `https://cloudnestra.com${hashScriptUrl}`;
    }
    
    console.log(`Fetching hash script: ${hashScriptUrl}\n`);
    const hashScript = await fetch(hashScriptUrl, 'https://cloudnestra.com/');
    
    // Save the hash script
    fs.writeFileSync('deobfuscation/current-hash-script.js', hashScript);
    
    console.log(`Hash script length: ${hashScript.length} characters\n`);
    
    // The script is obfuscated, but we need to find the placeholder resolution logic
    // Look for patterns that might indicate placeholder replacement
    
    console.log('🔍 ANALYZING HASH SCRIPT FOR PLACEHOLDER LOGIC...\n');
    
    // 1. Find all string replace operations
    console.log('1. Finding string replace operations:');
    const replacePattern = /\.replace\s*\(\s*[^,]+,\s*[^)]+\)/g;
    const replaceOps = [...hashScript.matchAll(replacePattern)];
    console.log(`   Found ${replaceOps.length} replace operations\n`);
    
    // 2. Look for placeholder patterns
    console.log('2. Looking for placeholder patterns:');
    const placeholderPatterns = [
      /\{v1\}/g,
      /\{v2\}/g,
      /\{v3\}/g,
      /\{v4\}/g,
      /\{s1\}/g,
      /\{s2\}/g,
      /\{s3\}/g,
      /\{s4\}/g
    ];
    
    placeholderPatterns.forEach((pattern, i) => {
      const matches = hashScript.match(pattern);
      if (matches) {
        console.log(`   Found ${matches.length} occurrences of ${pattern.source}`);
      }
    });
    
    console.log('\n3. Extracting context around placeholder usage:\n');
    
    // Find the context around {v1} usage
    const v1Index = hashScript.indexOf('{v1}');
    if (v1Index !== -1) {
      const contextStart = Math.max(0, v1Index - 200);
      const contextEnd = Math.min(hashScript.length, v1Index + 200);
      const context = hashScript.substring(contextStart, contextEnd);
      
      console.log('Context around {v1}:');
      console.log(context);
      console.log('\n');
    }
    
    // 4. Look for array/object definitions that might contain CDN mappings
    console.log('4. Looking for array/object definitions near placeholders:\n');
    
    // Find arrays that might contain domain mappings
    const arrayPattern = /\[["'][^"']+["']\s*,\s*["'][^"']+["']\s*,\s*["'][^"']+["']\s*,\s*["'][^"']+["']\]/g;
    const arrays = [...hashScript.matchAll(arrayPattern)];
    
    if (arrays.length > 0) {
      console.log(`Found ${arrays.length} potential mapping arrays:`);
      arrays.forEach((arr, i) => {
        console.log(`   ${i + 1}. ${arr[0]}`);
      });
    }
    
    console.log('\n5. Deobfuscating function names:\n');
    
    // The script uses obfuscated function names. Let's find the main function
    // that processes the innerHTML
    const innerHTMLPattern = /\.innerHTML\s*=\s*([^;]+)/g;
    const innerHTMLOps = [...hashScript.matchAll(innerHTMLPattern)];
    
    if (innerHTMLOps.length > 0) {
      console.log(`Found ${innerHTMLOps.length} innerHTML assignments:`);
      innerHTMLOps.forEach((op, i) => {
        console.log(`   ${i + 1}. innerHTML = ${op[1].substring(0, 100)}...`);
      });
    }
    
    console.log('\n6. Finding the decoder function:\n');
    
    // Look for the function that's called with the div ID
    const hiddenDiv = playerPage.match(/<div[^>]+id="([^"]+)"[^>]+style="display:none;">([^<]+)<\/div>/);
    const divId = hiddenDiv[1];
    
    console.log(`Hidden div ID: ${divId}`);
    
    // Search for this div ID in the hash script
    const divIdIndex = hashScript.indexOf(divId);
    if (divIdIndex !== -1) {
      console.log(`Found div ID in hash script at position ${divIdIndex}`);
      
      const contextStart = Math.max(0, divIdIndex - 300);
      const contextEnd = Math.min(hashScript.length, divIdIndex + 300);
      const context = hashScript.substring(contextStart, contextEnd);
      
      console.log('\nContext around div ID usage:');
      console.log(context);
    }
    
    console.log('\n7. Attempting to extract the resolver function:\n');
    
    // The hash script likely has a function that:
    // 1. Gets the innerHTML from the hidden div
    // 2. Decodes it (Caesar cipher)
    // 3. Replaces placeholders with actual domains
    // 4. Sets it back to innerHTML
    
    // Let's try to find this pattern
    const functionPattern = /function\s+(\w+)\s*\([^)]*\)\s*\{[^}]{100,1000}\}/g;
    const functions = [...hashScript.matchAll(functionPattern)];
    
    console.log(`Found ${functions.length} function definitions`);
    
    // Look for functions that contain both "innerHTML" and "replace"
    const relevantFunctions = functions.filter(f => 
      f[0].includes('innerHTML') && f[0].includes('replace')
    );
    
    if (relevantFunctions.length > 0) {
      console.log(`\nFound ${relevantFunctions.length} functions with innerHTML and replace:`);
      relevantFunctions.forEach((func, i) => {
        console.log(`\nFunction ${i + 1}:`);
        console.log(func[0]);
      });
    }
    
    console.log('\n8. Manual analysis required:\n');
    console.log('The hash script is heavily obfuscated. Next steps:');
    console.log('1. Beautify the hash script');
    console.log('2. Trace the execution flow from the div ID');
    console.log('3. Find where placeholders are replaced');
    console.log('4. Extract the actual CDN domain mappings');
    
    // Let's try a different approach - beautify and analyze
    console.log('\n9. Creating beautified version for manual analysis...\n');
    
    // Simple beautification
    let beautified = hashScript
      .replace(/;/g, ';\n')
      .replace(/\{/g, '{\n')
      .replace(/\}/g, '\n}\n');
    
    fs.writeFileSync('deobfuscation/hash-script-beautified.js', beautified);
    console.log('✅ Saved beautified script to hash-script-beautified.js');
    
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

extractPlaceholderResolver();
