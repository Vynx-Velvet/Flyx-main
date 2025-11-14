/**
 * ANALYZE PLAYER PAGE INLINE JS
 * 
 * Check if the player page HTML contains inline JavaScript
 * that reveals the CDN domain mappings
 */

const https = require('https');
const fs = require('fs');

async function analyzePlayerPageInlineJS() {
  console.log('📄 ANALYZING PLAYER PAGE INLINE JAVASCRIPT\n');
  console.log('='.repeat(80) + '\n');
  
  const tmdbId = 550;
  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${tmdbId}`;
  
  try {
    const embedPage = await fetch(embedUrl);
    const hash = embedPage.match(/data-hash="([^"]+)"/)[1];
    
    const rcpUrl = `https://cloudnestra.com/rcp/${hash}`;
    const rcpPage = await fetch(rcpUrl, embedUrl);
    const prorcp = rcpPage.match(/\/prorcp\/([A-Za-z0-9+\/=\-_]+)/)[1];
    
    const playerUrl = `https://cloudnestra.com/prorcp/${prorcp}`;
    const playerPage = await fetch(playerUrl, rcpUrl);
    
    console.log('✅ Got player page\n');
    
    // Extract all inline scripts
    const inlineScriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/g;
    const inlineScripts = [...playerPage.matchAll(inlineScriptPattern)];
    
    console.log(`Found ${inlineScripts.length} script tags\n`);
    
    inlineScripts.forEach((script, i) => {
      const scriptContent = script[1].trim();
      
      if (scriptContent.length > 0) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`INLINE SCRIPT ${i + 1}:`);
        console.log('='.repeat(80));
        console.log(scriptContent);
        console.log('\n');
        
        // Check if this script contains CDN mappings
        if (scriptContent.includes('v1') || scriptContent.includes('v2') || 
            scriptContent.includes('v3') || scriptContent.includes('v4')) {
          console.log('🎯 THIS SCRIPT CONTAINS v1/v2/v3/v4 REFERENCES!\n');
        }
        
        // Check for domain patterns
        const domainPattern = /[a-zA-Z0-9.-]+\.(com|net|io|org)/g;
        const domains = [...scriptContent.matchAll(domainPattern)];
        
        if (domains.length > 0) {
          console.log(`Found ${domains.length} domain references:`);
          const uniqueDomains = [...new Set(domains.map(d => d[0]))];
          uniqueDomains.forEach(domain => {
            console.log(`  - ${domain}`);
          });
          console.log('\n');
        }
      }
    });
    
    // Extract all external scripts
    console.log('\n' + '='.repeat(80));
    console.log('EXTERNAL SCRIPTS:');
    console.log('='.repeat(80) + '\n');
    
    const externalScriptPattern = /<script[^>]+src=["']([^"']+)["']/g;
    const externalScripts = [...playerPage.matchAll(externalScriptPattern)];
    
    externalScripts.forEach((script, i) => {
      console.log(`${i + 1}. ${script[1]}`);
    });
    
    // Look for any variable assignments in the page
    console.log('\n' + '='.repeat(80));
    console.log('SEARCHING FOR VARIABLE ASSIGNMENTS:');
    console.log('='.repeat(80) + '\n');
    
    const varPattern = /(const|let|var)\s+(\w+)\s*=\s*[^;]+;/g;
    const vars = [...playerPage.matchAll(varPattern)];
    
    if (vars.length > 0) {
      console.log(`Found ${vars.length} variable assignments:`);
      vars.forEach((v, i) => {
        console.log(`${i + 1}. ${v[0]}`);
      });
    }
    
    // Look for object literals that might contain CDN mappings
    console.log('\n' + '='.repeat(80));
    console.log('SEARCHING FOR OBJECT LITERALS:');
    console.log('='.repeat(80) + '\n');
    
    const objectPattern = /\{[^}]{20,200}\}/g;
    const objects = [...playerPage.matchAll(objectPattern)];
    
    if (objects.length > 0) {
      console.log(`Found ${objects.length} object literals:`);
      objects.slice(0, 10).forEach((obj, i) => {
        console.log(`${i + 1}. ${obj[0]}`);
      });
    }
    
    console.log('\n✅ ANALYSIS COMPLETE\n');
    
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

analyzePlayerPageInlineJS();
