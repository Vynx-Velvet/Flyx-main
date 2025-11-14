/**
 * EXECUTE SAVED HASH SCRIPT
 * 
 * Execute the saved hash script with the saved player page data
 * to discover the actual CDN mappings
 */

const vm = require('vm');
const fs = require('fs');

function executeSavedHashScript() {
  console.log('🚀 EXECUTING SAVED HASH SCRIPT TO DISCOVER CDN MAPPINGS\n');
  console.log('='.repeat(80) + '\n');
  
  try {
    // Load saved files
    console.log('Loading saved files...');
    const playerPage = fs.readFileSync('deobfuscation/current-player-page.html', 'utf8');
    const hashScript = fs.readFileSync('deobfuscation/current-hash-script.js', 'utf8');
    
    console.log(`✅ Loaded player page (${playerPage.length} characters)`);
    console.log(`✅ Loaded hash script (${hashScript.length} characters)\n`);
    
    // Extract the hidden div
    const hiddenDivMatch = playerPage.match(/<div[^>]+id="([^"]+)"[^>]+style="display:none;">([^<]+)<\/div>/);
    if (!hiddenDivMatch) {
      console.log('❌ Could not find hidden div in player page');
      return;
    }
    
    const divId = hiddenDivMatch[1];
    const encoded = hiddenDivMatch[2];
    
    console.log(`Div ID: ${divId}`);
    console.log(`Encoded: ${encoded.substring(0, 80)}...\n`);
    
    // Decode with Caesar +3 to see what we're working with
    const decoded = caesarShift(encoded, 3);
    console.log(`Decoded (Caesar +3): ${decoded.substring(0, 150)}...\n`);
    
    // Create sandbox
    console.log('Creating sandbox environment...\n');
    
    const capturedData = {
      windowAssignments: {},
      finalURL: null,
      allAssignments: []
    };
    
    const mockDocument = {
      getElementById: function(id) {
        console.log(`   📖 document.getElementById("${id}")`);
        
        if (id === divId) {
          return {
            _innerHTML: encoded,
            get innerHTML() {
              console.log(`   📖 Reading innerHTML`);
              return this._innerHTML;
            },
            set innerHTML(value) {
              console.log(`   ✍️  Setting innerHTML: ${value.substring(0, 100)}...`);
              this._innerHTML = value;
            }
          };
        }
        return null;
      }
    };
    
    const windowProxy = new Proxy({}, {
      set: function(target, property, value) {
        const valuePreview = typeof value === 'string' 
          ? (value.length > 100 ? value.substring(0, 100) + '...' : value)
          : typeof value;
        
        console.log(`   🎯 window["${property}"] = ${valuePreview}`);
        
        capturedData.allAssignments.push({
          property,
          value,
          type: typeof value
        });
        
        // Check if this is the div ID assignment
        if (property === divId && typeof value === 'string') {
          console.log(`\n   🎉 CAPTURED! This is the final URL assignment!\n`);
          capturedData.finalURL = value;
        }
        
        target[property] = value;
        return true;
      },
      get: function(target, property) {
        return target[property];
      }
    });
    
    const sandbox = {
      window: windowProxy,
      document: mockDocument,
      console: {
        log: () => {}, // Suppress script logs
        error: () => {},
        warn: () => {}
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
      setTimeout: (fn) => {
        if (typeof fn === 'function') {
          try {
            fn();
          } catch (e) {
            // Ignore errors in setTimeout callbacks
          }
        }
        return 0;
      },
      setInterval: () => 0,
      clearTimeout: () => {},
      clearInterval: () => {},
      location: {
        href: 'https://cloudnestra.com/prorcp/test',
        hostname: 'cloudnestra.com',
        protocol: 'https:',
        pathname: '/prorcp/test'
      },
      navigator: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };
    
    // Execute the hash script
    console.log('Executing hash script...\n');
    console.log('='.repeat(80) + '\n');
    
    try {
      const context = vm.createContext(sandbox);
      vm.runInContext(hashScript, context, {
        timeout: 15000,
        displayErrors: true
      });
      
      console.log('\n' + '='.repeat(80));
      console.log('✅ Hash script executed!\n');
      
    } catch (error) {
      console.log('\n' + '='.repeat(80));
      if (error.message.includes('timeout')) {
        console.log('⏱️  Execution timed out (captured data before timeout)\n');
      } else {
        console.log(`⚠️  Execution error: ${error.message}\n`);
      }
    }
    
    // Analyze results
    console.log('='.repeat(80));
    console.log('RESULTS');
    console.log('='.repeat(80) + '\n');
    
    console.log(`Total window assignments: ${capturedData.allAssignments.length}\n`);
    
    if (capturedData.finalURL) {
      console.log('🎉 SUCCESS! FINAL URL CAPTURED:\n');
      console.log(capturedData.finalURL);
      console.log('\n');
      
      // Compare with decoded
      console.log('Original (Caesar +3 decoded):\n');
      console.log(decoded);
      console.log('\n');
      
      // Extract CDN mappings
      console.log('='.repeat(80));
      console.log('CDN MAPPING ANALYSIS');
      console.log('='.repeat(80) + '\n');
      
      const placeholders = ['{v1}', '{v2}', '{v3}', '{v4}', '{s1}', '{s2}', '{s3}', '{s4}'];
      const mappings = {};
      
      for (const placeholder of placeholders) {
        if (decoded.includes(placeholder)) {
          console.log(`Found placeholder: ${placeholder}`);
          
          // Find what replaced it
          const parts = decoded.split(placeholder);
          if (parts.length === 2) {
            const before = parts[0];
            const after = parts[1];
            
            const beforeIndex = capturedData.finalURL.indexOf(before);
            if (beforeIndex !== -1) {
              const startIndex = beforeIndex + before.length;
              const afterIndex = capturedData.finalURL.indexOf(after, startIndex);
              
              if (afterIndex !== -1) {
                const replacement = capturedData.finalURL.substring(startIndex, afterIndex);
                mappings[placeholder] = replacement;
                console.log(`  ✅ ${placeholder} → "${replacement}"`);
              } else {
                console.log(`  ❌ Could not find 'after' part in final URL`);
              }
            } else {
              console.log(`  ❌ Could not find 'before' part in final URL`);
            }
          }
        }
      }
      
      console.log('\n');
      
      if (Object.keys(mappings).length > 0) {
        console.log('🎉 CDN MAPPINGS DISCOVERED!\n');
        console.log(JSON.stringify(mappings, null, 2));
        
        // Save to file
        fs.writeFileSync('deobfuscation/cdn-mappings.json', JSON.stringify(mappings, null, 2));
        console.log('\n✅ Saved to deobfuscation/cdn-mappings.json');
      } else {
        console.log('⚠️  No placeholder mappings found');
        console.log('   The URL might not contain placeholders, or they were resolved differently');
      }
      
    } else {
      console.log('❌ Final URL was not captured\n');
      
      console.log('Window assignments made:');
      capturedData.allAssignments.forEach((assignment, i) => {
        const valuePreview = typeof assignment.value === 'string'
          ? (assignment.value.length > 100 ? assignment.value.substring(0, 100) + '...' : assignment.value)
          : `[${assignment.type}]`;
        console.log(`${i + 1}. window["${assignment.property}"] = ${valuePreview}`);
      });
      
      // Check if any assignment looks like a URL
      const urlAssignments = capturedData.allAssignments.filter(a => 
        typeof a.value === 'string' && (a.value.startsWith('http') || a.value.includes('m3u8'))
      );
      
      if (urlAssignments.length > 0) {
        console.log('\n📌 Found URL-like assignments:');
        urlAssignments.forEach((assignment, i) => {
          console.log(`\n${i + 1}. window["${assignment.property}"]:`);
          console.log(assignment.value);
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

executeSavedHashScript();
