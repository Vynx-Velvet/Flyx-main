/**
 * TRACE ALL SCRIPTS IN THE CHAIN
 * 
 * The key must be loaded at some point. Let's trace EVERY script.
 */

const https = require('https');
const fs = require('fs');

async function traceAllScripts() {
  console.log('🔍 TRACING ALL SCRIPTS IN THE CHAIN\n');
  console.log('='.repeat(80) + '\n');
  
  // Step 1: Get the ProRCP page
  console.log('📄 STEP 1: Fetching ProRCP page...\n');
  
  const vidsrc = await fetch('https://vidsrc-embed.ru/embed/movie/550');
  const hash = vidsrc.match(/data-hash="([^"]+)"/)[1];
  
  const rcp = await fetch(`https://cloudnestra.com/rcp/${hash}`, 'https://vidsrc-embed.ru/');
  const prorcp = rcp.match(/src:\s*['"]\/prorcp\/([^'"]+)['"]/)[1];
  
  const player = await fetch(`https://cloudnestra.com/prorcp/${prorcp}`, 'https://cloudnestra.com/');
  
  console.log('✅ Got ProRCP page\n');
  
  // Step 2: Extract ALL script tags
  console.log('📜 STEP 2: Extracting ALL script tags...\n');
  
  const scriptTags = player.match(/<script[^>]*src=["']([^"']+)["'][^>]*>/gi);
  const inlineScripts = player.match(/<script[^>]*>(?!<\/script>)([\s\S]*?)<\/script>/gi);
  
  console.log(`Found ${scriptTags ? scriptTags.length : 0} external scripts`);
  console.log(`Found ${inlineScripts ? inlineScripts.length : 0} inline scripts\n`);
  
  // Step 3: List all external scripts
  if (scriptTags) {
    console.log('🔗 External Scripts:\n');
    scriptTags.forEach((tag, i) => {
      const src = tag.match(/src=["']([^"']+)["']/)[1];
      const fullUrl = src.startsWith('http') ? src : `https://cloudnestra.com${src}`;
      console.log(`   ${i + 1}. ${fullUrl}`);
    });
  }
  
  // Step 4: Analyze inline scripts for key hints
  console.log('\n\n🔍 STEP 3: Analyzing inline scripts for key hints...\n');
  
  if (inlineScripts) {
    inlineScripts.forEach((script, i) => {
      const content = script.replace(/<\/?script[^>]*>/gi, '').trim();
      
      // Look for crypto-related code
      if (content.match(/decrypt|cipher|aes|key|atob|fromCharCode/i)) {
        console.log(`\n📌 Inline Script ${i + 1} (CRYPTO-RELATED):`);
        console.log('─'.repeat(80));
        console.log(content.substring(0, 500));
        if (content.length > 500) console.log('...[truncated]');
        console.log('─'.repeat(80));
      }
      
      // Look for variable assignments with the div ID
      const hiddenDiv = player.match(/<div[^>]+id="([^"]+)"[^>]+style="display:none;">/);
      if (hiddenDiv) {
        const divId = hiddenDiv[1];
        if (content.includes(divId)) {
          console.log(`\n🎯 Inline Script ${i + 1} (REFERENCES DIV ID "${divId}"):`);
          console.log('─'.repeat(80));
          console.log(content);
          console.log('─'.repeat(80));
        }
      }
    });
  }
  
  // Step 5: Fetch and analyze the hash script (most likely to contain the key)
  console.log('\n\n🔐 STEP 4: Analyzing the hash script (most likely key location)...\n');
  
  const hashScriptMatch = player.match(/src=["']\/([^"']+\/[a-f0-9]{32}\.js)["']/);
  if (hashScriptMatch) {
    const hashScriptUrl = `https://cloudnestra.com/${hashScriptMatch[1]}`;
    console.log(`Fetching: ${hashScriptUrl}\n`);
    
    const hashScript = await fetch(hashScriptUrl, 'https://cloudnestra.com/');
    
    fs.writeFileSync('hash-script-full.js', hashScript);
    console.log('💾 Saved to hash-script-full.js\n');
    
    // Try to find the string array (where keys are usually hidden)
    console.log('🔍 Looking for string arrays in hash script...\n');
    
    const stringArrayMatch = hashScript.match(/var\s+\w+\s*=\s*\[([^\]]{100,})\]/);
    if (stringArrayMatch) {
      const arrayContent = stringArrayMatch[1];
      const strings = arrayContent.match(/["']([^"']+)["']/g);
      
      console.log(`Found string array with ${strings ? strings.length : 0} strings\n`);
      
      if (strings) {
        console.log('First 20 strings:');
        strings.slice(0, 20).forEach((s, i) => {
          console.log(`   ${i + 1}. ${s}`);
        });
        
        // Look for crypto-related strings
        console.log('\n\n🔐 Crypto-related strings:');
        const cryptoStrings = strings.filter(s => 
          s.match(/aes|decrypt|cipher|key|crypto|encode|decode/i)
        );
        cryptoStrings.forEach(s => console.log(`   ${s}`));
        
        // Look for hex strings (potential keys)
        console.log('\n\n🔑 Hex-like strings (potential keys):');
        const hexStrings = strings.filter(s => 
          s.match(/["']([a-f0-9]{16,64})["']/)
        );
        hexStrings.forEach(s => console.log(`   ${s}`));
      }
    }
    
    // Look for function that processes the hidden div
    console.log('\n\n🎯 Looking for getElementById in hash script...\n');
    const getElemMatches = hashScript.match(/.{200}getElementById.{200}/gi);
    if (getElemMatches) {
      console.log(`Found ${getElemMatches.length} getElementById references:\n`);
      getElemMatches.forEach((match, i) => {
        console.log(`\n${i + 1}. ${match}\n`);
      });
    }
  }
  
  // Step 6: Check for any other scripts that might load
  console.log('\n\n📦 STEP 5: Checking for dynamically loaded scripts...\n');
  
  const dynamicScripts = player.match(/createElement\s*\(\s*["']script["']\s*\)/gi);
  if (dynamicScripts) {
    console.log(`Found ${dynamicScripts.length} dynamic script creations`);
    
    // Look for the URLs being set
    const scriptUrls = player.match(/\.src\s*=\s*["']([^"']+)["']/gi);
    if (scriptUrls) {
      console.log('\nDynamic script URLs:');
      scriptUrls.forEach(url => console.log(`   ${url}`));
    }
  }
  
  console.log('\n\n✅ SCRIPT TRACE COMPLETE\n');
  console.log('The key is most likely in:');
  console.log('1. The hash script string array');
  console.log('2. An inline script that processes the div');
  console.log('3. A dynamically loaded script\n');
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

traceAllScripts().catch(console.error);
