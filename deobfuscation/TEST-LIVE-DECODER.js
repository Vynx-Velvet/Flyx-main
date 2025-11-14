/**
 * TEST THE LIVE DECODER
 * 
 * Load the hash script and test it with real data
 */

const https = require('https');
const vm = require('vm');

async function testLiveDecoder() {
  console.log('🧪 TESTING LIVE DECODER\n');
  console.log('='.repeat(80) + '\n');
  
  // Get fresh data
  console.log('📡 Fetching fresh player page...\n');
  
  const vidsrc = await fetch('https://vidsrc-embed.ru/embed/movie/550');
  const hash = vidsrc.match(/data-hash="([^"]+)"/)[1];
  
  const rcp = await fetch(`https://cloudnestra.com/rcp/${hash}`, 'https://vidsrc-embed.ru/');
  const prorcp = rcp.match(/src:\s*['"]\/prorcp\/([^'"]+)['"]/)[1];
  
  const player = await fetch(`https://cloudnestra.com/prorcp/${prorcp}`, 'https://cloudnestra.com/');
  
  // Get the div ID and encoded data
  const hiddenDiv = player.match(/<div[^>]+id="([^"]+)"[^>]+style="display:none;">([^<]+)<\/div>/);
  const divId = hiddenDiv[1];
  const encoded = hiddenDiv[2];
  
  console.log(`✅ Got data:`);
  console.log(`   Div ID: ${divId}`);
  console.log(`   Encoded: ${encoded.substring(0, 100)}...\n\n`);
  
  // Get the hash script URL
  const hashScriptMatch = player.match(/src=["']([^"']+[a-f0-9]{32}\.js[^"']*)["']/);
  let hashScriptUrl = hashScriptMatch[1];
  if (!hashScriptUrl.startsWith('http')) {
    hashScriptUrl = `https://cloudnestra.com${hashScriptUrl}`;
  }
  
  console.log(`📜 Fetching hash script: ${hashScriptUrl}\n`);
  
  const hashScript = await fetch(hashScriptUrl, 'https://cloudnestra.com/');
  
  console.log(`✅ Downloaded ${hashScript.length} bytes\n\n`);
  
  // Create a sandbox environment
  console.log('🔧 Creating sandbox environment...\n');
  
  const sandbox = {
    window: {},
    document: {
      getElementById: function(id) {
        if (id === divId) {
          return { innerHTML: encoded };
        }
        return null;
      }
    },
    console: console,
    atob: (str) => Buffer.from(str, 'base64').toString('binary'),
    btoa: (str) => Buffer.from(str, 'binary').toString('base64')
  };
  
  // Execute the hash script in the sandbox
  console.log('⚙️  Executing hash script...\n');
  
  try {
    vm.createContext(sandbox);
    
    // Try to execute with timeout
    try {
      vm.runInContext(hashScript, sandbox, { timeout: 2000 });
      console.log('✅ Script executed successfully\n\n');
    } catch (timeoutError) {
      if (timeoutError.message.includes('timeout')) {
        console.log('⏱️  Script timed out, but checking if result was set...\n\n');
      } else {
        throw timeoutError;
      }
    }
    
    // Check if the div ID variable was set
    if (sandbox.window[divId]) {
      console.log('🎉 SUCCESS! Decoded M3U8 URL:\n');
      console.log(sandbox.window[divId]);
      console.log('\n');
      return sandbox.window[divId];
    } else {
      console.log('❌ The div ID variable was not set in window');
      console.log('\nWindow keys:', Object.keys(sandbox.window));
      
      // Check if there are any string values that look like URLs
      console.log('\nChecking all window values for URLs...\n');
      for (const key in sandbox.window) {
        const value = sandbox.window[key];
        if (typeof value === 'string' && (value.includes('http') || value.includes('.m3u8'))) {
          console.log(`   ${key}: ${value.substring(0, 100)}...`);
        }
      }
      console.log('\n');
    }
  } catch (error) {
    console.log('❌ Error executing script:', error.message);
    console.log(error.stack);
    console.log('\n');
  }
  
  return null;
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

testLiveDecoder().catch(console.error);
