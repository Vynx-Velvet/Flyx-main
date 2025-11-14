/**
 * FETCH AND ANALYZE SBX.JS
 * 
 * This script likely contains the decryption logic that converts
 * the div ID variable into the actual M3U8 URL
 */

const https = require('https');
const fs = require('fs');

async function fetchSbx() {
  console.log('🔐 FETCHING SBX.JS (THE DECODER)\n');
  console.log('='.repeat(80) + '\n');
  
  const sbxUrl = 'https://cloudnestra.com/sbx.js?t=1751380596';
  
  console.log(`Fetching: ${sbxUrl}\n`);
  
  const sbx = await fetch(sbxUrl);
  
  fs.writeFileSync('sbx-decoder.js', sbx);
  console.log(`✅ Downloaded ${sbx.length} bytes`);
  console.log('💾 Saved to sbx-decoder.js\n\n');
  
  // Analyze the content
  console.log('🔍 ANALYZING SBX.JS...\n');
  console.log('─'.repeat(80) + '\n');
  
  // Check if it's obfuscated
  if (sbx.match(/var _0x[a-f0-9]+=/)) {
    console.log('⚠️  Script is OBFUSCATED\n');
  }
  
  // Look for decrypt/decode functions
  console.log('1️⃣  Looking for decrypt/decode functions...\n');
  const decryptFuncs = sbx.match(/function\s+\w*decrypt\w*\s*\([^)]*\)/gi);
  const decodeFuncs = sbx.match(/function\s+\w*decode\w*\s*\([^)]*\)/gi);
  
  if (decryptFuncs) {
    console.log(`Found ${decryptFuncs.length} decrypt functions:`);
    decryptFuncs.forEach(f => console.log(`   ${f}`));
  }
  
  if (decodeFuncs) {
    console.log(`\nFound ${decodeFuncs.length} decode functions:`);
    decodeFuncs.forEach(f => console.log(`   ${f}`));
  }
  
  // Look for atob (base64 decode)
  console.log('\n\n2️⃣  Looking for atob usage...\n');
  const atobMatches = sbx.match(/.{100}atob.{100}/gi);
  if (atobMatches) {
    console.log(`Found ${atobMatches.length} atob usages (first 3):\n`);
    atobMatches.slice(0, 3).forEach((m, i) => {
      console.log(`${i + 1}. ${m}\n`);
    });
  }
  
  // Look for getElementById
  console.log('\n3️⃣  Looking for getElementById...\n');
  const getElemMatches = sbx.match(/.{100}getElementById.{100}/gi);
  if (getElemMatches) {
    console.log(`Found ${getElemMatches.length} getElementById usages:\n`);
    getElemMatches.forEach((m, i) => {
      console.log(`${i + 1}. ${m}\n`);
    });
  }
  
  // Look for crypto operations
  console.log('\n4️⃣  Looking for crypto operations...\n');
  const cryptoPatterns = [
    /CryptoJS/gi,
    /AES\.decrypt/gi,
    /cipher/gi,
    /\.enc\./gi,
    /\.dec\./gi
  ];
  
  cryptoPatterns.forEach(pattern => {
    const matches = sbx.match(pattern);
    if (matches) {
      console.log(`${pattern}: ${matches.length} matches`);
      
      // Show context
      const contextMatches = sbx.match(new RegExp(`.{100}${pattern.source}.{100}`, 'gi'));
      if (contextMatches && contextMatches.length < 5) {
        contextMatches.forEach(m => console.log(`   ${m}\n`));
      }
    }
  });
  
  // Look for key strings
  console.log('\n\n5️⃣  Looking for potential keys...\n');
  const hexStrings = sbx.match(/["']([a-f0-9]{16,64})["']/gi);
  if (hexStrings) {
    console.log(`Found ${hexStrings.length} hex strings (first 10):\n`);
    hexStrings.slice(0, 10).forEach(h => console.log(`   ${h}`));
  }
  
  // Show first 2000 chars
  console.log('\n\n6️⃣  First 2000 characters:\n');
  console.log('─'.repeat(80));
  console.log(sbx.substring(0, 2000));
  console.log('─'.repeat(80));
  
  console.log('\n\n✅ ANALYSIS COMPLETE\n');
  console.log('Check sbx-decoder.js for the full script');
}

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://cloudnestra.com/'
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

fetchSbx().catch(console.error);
