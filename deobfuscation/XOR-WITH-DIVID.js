/**
 * XOR WITH DIV ID
 * 
 * The div ID might be the XOR key!
 */

const https = require('https');

async function xorWithDivId() {
  console.log('🔐 XOR WITH DIV ID\n');
  console.log('='.repeat(80) + '\n');
  
  const vidsrc = await fetch('https://vidsrc-embed.ru/embed/movie/550');
  const hash = vidsrc.match(/data-hash="([^"]+)"/)[1];
  
  const rcp = await fetch(`https://cloudnestra.com/rcp/${hash}`, 'https://vidsrc-embed.ru/');
  const prorcp = rcp.match(/src:\s*['"]\/prorcp\/([^'"]+)['"]/)[1];
  
  const player = await fetch(`https://cloudnestra.com/prorcp/${prorcp}`, 'https://cloudnestra.com/');
  const hiddenDiv = player.match(/<div[^>]+id="([^"]+)"[^>]+style="display:none;">([^<]+)<\/div>/);
  
  const divId = hiddenDiv[1];
  const encoded = hiddenDiv[2];
  
  console.log(`Div ID: ${divId}`);
  console.log(`Encoded: ${encoded.substring(0, 100)}...\n\n`);
  
  // Try: reverse + base64 + XOR with divId
  console.log('Method: reverse → base64 → XOR with divId\n');
  
  try {
    const reversed = encoded.split('').reverse().join('');
    const base64Decoded = Buffer.from(reversed, 'base64');
    
    console.log(`Base64 decoded ${base64Decoded.length} bytes\n`);
    
    // XOR with divId
    const xored = Buffer.alloc(base64Decoded.length);
    for (let i = 0; i < base64Decoded.length; i++) {
      xored[i] = base64Decoded[i] ^ divId.charCodeAt(i % divId.length);
    }
    
    const result = xored.toString('utf8');
    console.log(`XOR result: ${result.substring(0, 200)}\n`);
    
    if (result.includes('http') || result.includes('.m3u8') || result.includes('putgate')) {
      console.log('🎉 SUCCESS!\n');
      console.log(result);
      return result;
    }
    
  } catch (e) {
    console.log(`Error: ${e.message}\n`);
  }
  
  // Try: base64 + XOR with divId
  console.log('\nMethod: base64 → XOR with divId\n');
  
  try {
    const base64Decoded = Buffer.from(encoded, 'base64');
    
    const xored = Buffer.alloc(base64Decoded.length);
    for (let i = 0; i < base64Decoded.length; i++) {
      xored[i] = base64Decoded[i] ^ divId.charCodeAt(i % divId.length);
    }
    
    const result = xored.toString('utf8');
    console.log(`XOR result: ${result.substring(0, 200)}\n`);
    
    if (result.includes('http') || result.includes('.m3u8') || result.includes('putgate')) {
      console.log('🎉 SUCCESS!\n');
      console.log(result);
      return result;
    }
    
  } catch (e) {
    console.log(`Error: ${e.message}\n`);
  }
  
  // Try XOR with reversed divId
  console.log('\nMethod: reverse → base64 → XOR with reversed divId\n');
  
  try {
    const reversed = encoded.split('').reverse().join('');
    const base64Decoded = Buffer.from(reversed, 'base64');
    const reversedDivId = divId.split('').reverse().join('');
    
    const xored = Buffer.alloc(base64Decoded.length);
    for (let i = 0; i < base64Decoded.length; i++) {
      xored[i] = base64Decoded[i] ^ reversedDivId.charCodeAt(i % reversedDivId.length);
    }
    
    const result = xored.toString('utf8');
    console.log(`XOR result: ${result.substring(0, 200)}\n`);
    
    if (result.includes('http') || result.includes('.m3u8') || result.includes('putgate')) {
      console.log('🎉 SUCCESS!\n');
      console.log(result);
      return result;
    }
    
  } catch (e) {
    console.log(`Error: ${e.message}\n`);
  }
  
  console.log('\n❌ XOR with divId did not work\n');
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

xorWithDivId().catch(console.error);
