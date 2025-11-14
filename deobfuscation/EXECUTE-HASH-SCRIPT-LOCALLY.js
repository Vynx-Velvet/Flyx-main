/**
 * EXECUTE HASH SCRIPT LOCALLY
 * 
 * Run the obfuscated hash script in a controlled Node.js environment
 * to capture the actual CDN domain mappings for all placeholder versions
 */

const https = require('https');
const vm = require('vm');
const fs = require('fs');

async function executeHashScriptLocally() {
  console.log('🚀 EXECUTING HASH SCRIPT LOCALLY TO DISCOVER CDN MAPPINGS\n');
  console.log('='.repeat(80) + '\n');
  
  const tmdbId = 550;
  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${tmdbId}`;
  
  try {
    // Step 1: Get the player page
    console.log('Step 1: Fetching player page...');
    const embedPage = await fetch(embedUrl);
    const hash = embedPage.match(/data-hash="([^"]+)"/)[1];
    
    const rcpUrl = `https://cloudnestra.com/rcp/${hash}`;
    const rcpPage = await fetch(rcpUrl, embedUrl);
    const prorcp = rcpPage.match(/\/prorcp\/([A-Za-z0-9+\/=\-_]+)/)[1];
    
    const playerUrl = `https://cloudnestra.com/prorcp/${prorcp}`;
    const playerPage = await fetch(playerUrl, rcpUrl);
    
    // Extract the hidden div
    const hiddenDiv = playerPage.match(/<div[^>]+id="([^"]+)"[^>]+style="display:none;">([^<]+)<\/div>/);
    const divId = hiddenDiv[1];
    const encoded = hiddenDiv[2];
    
    console.log(`✅ Got player page`);
    console.log(`   Div ID: ${divId}`);
    console.log(`   Encoded: ${encoded.substring(0, 60)}...\n`);
    
    // Step 2: Get the hash script
    console.log('Step 2: Fetching hash script...');
    const hashScriptMatch = playerPage.match(/src=["']([^"']+[a-f0-9]{32}\.js[^"']*)["']/);
    let hashScriptUrl = hashScriptMatch[1];
    if (!hashScriptUrl.startsWith('http')) {
      hashScriptUrl = `https://cloudnestra.com${hashScriptUrl}`;
    }
    
    const hashScript = await fetch(hashScriptUrl, 'https://cloudnestra.com/');
    console.log(`✅ Got hash script (${hashScript.length} characters)\n`);
    
    // Step 3: Create a sandbox environment
    console.log('Step 3: Creating sandbox environment...');
    
    const capturedData = {
      windowAssignments: {},
      innerHTMLReads: [],
      innerHTMLWrites: [],
      stringReplacements: [],
      finalURL: null
    };
    
    // Create a mock DOM
    const mockDocument = {
      getElementById: function(id) {
        console.log(`   📖 getElementById("${id}") called`);
        capturedData.innerHTMLReads.push(id);
        
        if (id === divId) {
          return {
            innerHTML: encoded,
            _innerHTML: encoded,
            get innerHTML() {
              return this._innerHTML;
            },
            set innerHTML(value) {
              console.log(`   ✍️  Setting innerHTML to: ${value.substring(0, 100)}...`);
              capturedData.innerHTMLWrites.push({
                id: id,
                value: value
              });
              this._innerHTML = value;
            }
          };
        }
        return null;
      }
    };
    
    // Create sandbox with interceptors
    const sandbox = {
      window: new Proxy({}, {
        set: function(target, property, value) {
          console.log(`   🎯 window["${property}"] = ${typeof value === 'string' ? value.substring(0, 100) + '...' : typeof value}`);
          
          if (property === divId) {
            capturedData.finalURL = value;
            console.log(`\n   🎉 CAPTURED FINAL URL!`);
            console.log(`   ${value}\n`);
          }
          
          capturedData.windowAssignments[property] = value;
          target[property] = value;
          return true;
        },
        get: function(target, property) {
          return target[property];
        }
      }),
      document: mockDocument,
      console: {
        log: (...args) => {
          // Suppress script console.log
        }
      },
      atob: (str) => {
        try {
          return Buffer.from(str, 'base64').toString('binary');
        } catch (e) {
          return str;
        }
      },
      btoa: (str) => {
        try {
          return Buffer.from(str, 'binary').toString('base64');
        } catch (e) {
          return str;
        }
      },
      setTimeout: (fn, delay) => {
        // Execute immediately
        if (typeof fn === 'function') {
          fn();
        }
      },
      setInterval: (fn, delay) => {
        // Don't execute intervals
        return 0;
      },
      clearTimeout: () => {},
      clearInterval: () => {},
      location: {
        href: playerUrl,
        hostname: 'cloudnestra.com',
        protocol: 'https:',
        pathname: `/prorcp/${prorcp}`
      },
      navigator: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      // Intercept String.prototype.replace
      String: function(str) {
        return new String(str);
      }
    };
    
    // Add String prototype methods
    sandbox.String.prototype = String.prototype;
    
    console.log('✅ Sandbox created\n');
    
    // Step 4: Execute the hash script
    console.log('Step 4: Executing hash script...\n');
    
    try {
      const context = vm.createContext(sandbox);
      vm.runInContext(hashScript, context, {
        timeout: 10000,
        displayErrors: true
      });
      
      console.log('\n✅ Hash script executed successfully!\n');
      
    } catch (error) {
      if (error.message.includes('timeout')) {
        console.log('\n⏱️  Script execution timed out (this is expected)\n');
      } else {
        console.log(`\n⚠️  Script error: ${error.message}\n`);
      }
    }
    
    // Step 5: Analyze captured data
    console.log('='.repeat(80));
    console.log('CAPTURED DATA ANALYSIS');
    console.log('='.repeat(80) + '\n');
    
    console.log(`Window assignments: ${Object.keys(capturedData.windowAssignments).length}`);
    console.log(`innerHTML reads: ${capturedData.innerHTMLReads.length}`);
    console.log(`innerHTML writes: ${capturedData.innerHTMLWrites.length}\n`);
    
    if (capturedData.finalURL) {
      console.log('🎉 SUCCESS! FINAL URL CAPTURED:\n');
      console.log(capturedData.finalURL);
      console.log('\n');
      
      // Compare with original
      const decoded = caesarShift(encoded, 3);
      console.log('Original (decoded with Caesar +3):\n');
      console.log(decoded.substring(0, 200) + '...');
      console.log('\n');
      
      // Extract CDN mappings
      console.log('='.repeat(80));
      console.log('CDN MAPPING DISCOVERY');
      console.log('='.repeat(80) + '\n');
      
      // Find what replaced the placeholders
      const placeholders = ['{v1}', '{v2}', '{v3}', '{v4}', '{s1}', '{s2}', '{s3}', '{s4}'];
      const mappings = {};
      
      for (const placeholder of placeholders) {
        if (decoded.includes(placeholder)) {
          // Find what it was replaced with
          const decodedIndex = decoded.indexOf(placeholder);
          const finalIndex = decodedIndex; // Same position
          
          // Extract the replacement from the final URL
          const beforePlaceholder = decoded.substring(0, decodedIndex);
          const afterPlaceholder = decoded.substring(decodedIndex + placeholder.length);
          
          // Find the corresponding section in the final URL
          const finalBeforeIndex = capturedData.finalURL.indexOf(beforePlaceholder);
          if (finalBeforeIndex !== -1) {
            const startIndex = finalBeforeIndex + beforePlaceholder.length;
            const endIndex = capturedData.finalURL.indexOf(afterPlaceholder, startIndex);
            
            if (endIndex !== -1) {
              const replacement = capturedData.finalURL.substring(startIndex, endIndex);
              mappings[placeholder] = replacement;
              console.log(`✅ ${placeholder} → "${replacement}"`);
            }
          }
        }
      }
      
      if (Object.keys(mappings).length > 0) {
        console.log('\n🎉 CDN MAPPINGS DISCOVERED!\n');
        console.log('Mappings:');
        Object.entries(mappings).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
        
        // Save mappings to file
        fs.writeFileSync('deobfuscation/cdn-mappings.json', JSON.stringify(mappings, null, 2));
        console.log('\n✅ Saved to deobfuscation/cdn-mappings.json');
      } else {
        console.log('❌ Could not extract CDN mappings automatically');
        console.log('   The placeholders might have been replaced in a complex way');
      }
      
    } else {
      console.log('❌ Failed to capture final URL');
      console.log('   The hash script might not have executed the expected code path\n');
      
      // Show what was captured
      if (capturedData.innerHTMLWrites.length > 0) {
        console.log('innerHTML writes captured:');
        capturedData.innerHTMLWrites.forEach((write, i) => {
          console.log(`${i + 1}. ${write.id}: ${write.value.substring(0, 100)}...`);
        });
      }
      
      if (Object.keys(capturedData.windowAssignments).length > 0) {
        console.log('\nWindow assignments:');
        Object.entries(capturedData.windowAssignments).forEach(([key, value]) => {
          const valueStr = typeof value === 'string' ? value.substring(0, 100) + '...' : typeof value;
          console.log(`  ${key}: ${valueStr}`);
        });
      }
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    console.log(error.stack);
  }
}

function caesarShift(text, shift) {
  return text.split('').map(c => {
    const code = c.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      return String.fromCharCode(((code - 65 + shift + 26) % 26) + 65);
    } else if (code >= 97 && code <= 122) {
      return String.fromCharCode(((code - 97 + shift + 26) % 26) + 97);
    }
    return c;
  }).join('');
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

executeHashScriptLocally();
