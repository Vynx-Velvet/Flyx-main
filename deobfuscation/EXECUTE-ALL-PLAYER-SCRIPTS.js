/**
 * EXECUTE ALL PLAYER SCRIPTS
 * 
 * Fetch and execute ALL scripts from the player page including Playerjs
 * to discover how placeholders are resolved
 */

const https = require('https');
const vm = require('vm');
const fs = require('fs');

async function executeAllPlayerScripts() {
  console.log('🚀 EXECUTING ALL PLAYER SCRIPTS TO FIND PLACEHOLDER RESOLUTION\n');
  console.log('='.repeat(80) + '\n');
  
  try {
    // Load saved player page
    const playerPage = fs.readFileSync('deobfuscation/current-player-page.html', 'utf8');
    
    // Extract hidden div
    const hiddenDivMatch = playerPage.match(/<div[^>]+id="([^"]+)"[^>]+style="display:none;">([^<]+)<\/div>/);
    const divId = hiddenDivMatch[1];
    const encoded = hiddenDivMatch[2];
    
    console.log(`Div ID: ${divId}`);
    console.log(`Encoded: ${encoded.substring(0, 80)}...\n`);
    
    // Extract ALL script URLs from player page
    const scriptPattern = /<script[^>]+src=["']([^"']+)["']/g;
    const scriptMatches = [...playerPage.matchAll(scriptPattern)];
    
    console.log(`Found ${scriptMatches.length} external scripts:\n`);
    
    const scripts = [];
    for (let i = 0; i < scriptMatches.length; i++) {
      let scriptUrl = scriptMatches[i][1];
      
      if (!scriptUrl.startsWith('http')) {
        if (scriptUrl.startsWith('//')) {
          scriptUrl = 'https:' + scriptUrl;
        } else {
          scriptUrl = 'https://cloudnestra.com' + scriptUrl;
        }
      }
      
      console.log(`${i + 1}. ${scriptUrl}`);
      scripts.push({ url: scriptUrl, index: i + 1 });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('FETCHING ALL SCRIPTS');
    console.log('='.repeat(80) + '\n');
    
    const scriptContents = [];
    for (const script of scripts) {
      try {
        console.log(`Fetching script ${script.index}...`);
        const content = await fetch(script.url);
        scriptContents.push({
          url: script.url,
          content: content,
          index: script.index
        });
        console.log(`✅ Got ${content.length} characters`);
      } catch (error) {
        console.log(`❌ Failed: ${error.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('CREATING COMPREHENSIVE SANDBOX');
    console.log('='.repeat(80) + '\n');
    
    const capturedData = {
      placeholderResolutions: [],
      urlAssignments: [],
      stringReplacements: [],
      finalURL: null
    };
    
    // Create comprehensive sandbox
    const mockDocument = {
      getElementById: function(id) {
        console.log(`   📖 document.getElementById("${id}")`);
        
        if (id === divId) {
          return {
            _innerHTML: encoded,
            get innerHTML() {
              return this._innerHTML;
            },
            set innerHTML(value) {
              console.log(`   ✍️  innerHTML set: ${value.substring(0, 100)}...`);
              this._innerHTML = value;
            }
          };
        }
        return { innerHTML: '', style: {} };
      },
      createElement: () => ({ style: {}, appendChild: () => {} }),
      body: { appendChild: () => {} },
      head: { appendChild: () => {} }
    };
    
    const windowProxy = new Proxy({}, {
      set: function(target, property, value) {
        if (property === divId && typeof value === 'string') {
          console.log(`\n   🎯 window["${divId}"] = ${value.substring(0, 100)}...`);
          capturedData.finalURL = value;
        }
        target[property] = value;
        return true;
      },
      get: function(target, property) {
        if (property === divId && target[divId]) {
          return target[divId];
        }
        return target[property];
      }
    });
    
    // Intercept String.prototype.replace
    const originalReplace = String.prototype.replace;
    String.prototype.replace = function(search, replacement) {
      const result = originalReplace.call(this, search, replacement);
      
      // Check if this is replacing a placeholder
      if (typeof search === 'string' && search.includes('{v')) {
        console.log(`\n   🔍 String.replace("${search}", "${replacement}")`);
        console.log(`      Input: ${this.substring(0, 100)}...`);
        console.log(`      Output: ${result.substring(0, 100)}...`);
        
        capturedData.stringReplacements.push({
          search,
          replacement,
          input: this.toString(),
          output: result
        });
      } else if (typeof search === 'object' && search instanceof RegExp && search.source.includes('v')) {
        console.log(`\n   🔍 String.replace(/${search.source}/, ...)`);
        console.log(`      Input: ${this.substring(0, 100)}...`);
        console.log(`      Output: ${result.substring(0, 100)}...`);
        
        capturedData.stringReplacements.push({
          search: search.source,
          replacement: typeof replacement === 'function' ? '[function]' : replacement,
          input: this.toString(),
          output: result
        });
      }
      
      return result;
    };
    
    const sandbox = {
      window: windowProxy,
      document: mockDocument,
      console: {
        log: () => {},
        error: () => {},
        warn: () => {}
      },
      atob: (str) => Buffer.from(str, 'base64').toString('binary'),
      btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
      setTimeout: (fn) => { if (typeof fn === 'function') try { fn(); } catch(e) {} return 0; },
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
      },
      XMLHttpRequest: function() {
        return {
          open: () => {},
          send: () => {},
          setRequestHeader: () => {}
        };
      },
      fetch: () => Promise.resolve({ json: () => Promise.resolve({}) }),
      localStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
      },
      String: String
    };
    
    console.log('='.repeat(80));
    console.log('EXECUTING ALL SCRIPTS IN ORDER');
    console.log('='.repeat(80) + '\n');
    
    const context = vm.createContext(sandbox);
    
    for (const script of scriptContents) {
      console.log(`\nExecuting script ${script.index}: ${script.url.split('/').pop()}`);
      console.log('-'.repeat(80));
      
      try {
        vm.runInContext(script.content, context, {
          timeout: 5000,
          displayErrors: false
        });
        console.log('✅ Executed successfully');
      } catch (error) {
        if (error.message.includes('timeout')) {
          console.log('⏱️  Timed out');
        } else {
          console.log(`⚠️  Error: ${error.message.substring(0, 100)}`);
        }
      }
    }
    
    // Restore String.prototype.replace
    String.prototype.replace = originalReplace;
    
    console.log('\n' + '='.repeat(80));
    console.log('RESULTS');
    console.log('='.repeat(80) + '\n');
    
    if (capturedData.stringReplacements.length > 0) {
      console.log(`🎉 CAPTURED ${capturedData.stringReplacements.length} STRING REPLACEMENTS!\n`);
      
      capturedData.stringReplacements.forEach((rep, i) => {
        console.log(`${i + 1}. Replace "${rep.search}" with "${rep.replacement}"`);
        
        // Check if this resolved a placeholder
        if (rep.input.includes('{v') && !rep.output.includes('{v')) {
          console.log(`   ✅ THIS RESOLVED PLACEHOLDERS!`);
          console.log(`   Before: ${rep.input.substring(0, 150)}...`);
          console.log(`   After:  ${rep.output.substring(0, 150)}...`);
          
          // Extract the mapping
          const placeholders = rep.input.match(/\{v\d+\}/g) || [];
          placeholders.forEach(placeholder => {
            const inputIndex = rep.input.indexOf(placeholder);
            const before = rep.input.substring(0, inputIndex);
                const after = rep.input.substring(inputIndex + placeholder.length);
            
            const outputBeforeIndex = rep.output.indexOf(before);
            if (outputBeforeIndex !== -1) {
              const startIndex = outputBeforeIndex + before.length;
              const afterIndex = rep.output.indexOf(after, startIndex);
              
              if (afterIndex !== -1) {
                const resolved = rep.output.substring(startIndex, afterIndex);
                console.log(`   🎯 ${placeholder} → "${resolved}"`);
                
                capturedData.placeholderResolutions.push({
                  placeholder,
                  resolved
                });
              }
            }
          });
        }
      });
    }
    
    if (capturedData.finalURL) {
      console.log(`\n🎉 FINAL URL CAPTURED:\n`);
      console.log(capturedData.finalURL);
    }
    
    if (capturedData.placeholderResolutions.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('🎉 CDN MAPPINGS DISCOVERED!');
      console.log('='.repeat(80) + '\n');
      
      const mappings = {};
      capturedData.placeholderResolutions.forEach(res => {
        if (!mappings[res.placeholder]) {
          mappings[res.placeholder] = res.resolved;
        }
      });
      
      console.log(JSON.stringify(mappings, null, 2));
      
      fs.writeFileSync('deobfuscation/cdn-mappings.json', JSON.stringify(mappings, null, 2));
      console.log('\n✅ Saved to deobfuscation/cdn-mappings.json');
    } else {
      console.log('\n⚠️  No placeholder resolutions captured');
      console.log('The placeholders might be resolved differently or in a script we missed');
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    console.log(error.stack);
  }
}

function fetch(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : require('http');
    
    client.get(url, {
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

executeAllPlayerScripts();
