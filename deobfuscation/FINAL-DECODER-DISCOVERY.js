/**
 * FINAL DECODER DISCOVERY
 * 
 * The encoded data itself looks like character-substituted URLs!
 * Let's NOT reverse or base64 decode, just look at the raw data
 */

const https = require('https');

async function finalDiscovery() {
  console.log('🔍 FINAL DECODER DISCOVERY\n');
  console.log('='.repeat(80) + '\n');
  
  const vidsrc = await fetch('https://vidsrc-embed.ru/embed/movie/550');
  const hash = vidsrc.match(/data-hash="([^"]+)"/)[1];
  
  const rcp = await fetch(`https://cloudnestra.com/rcp/${hash}`, 'https://vidsrc-embed.ru/');
  const prorcp = rcp.match(/src:\s*['"]\/prorcp\/([^'"]+)['"]/)[1];
  
  const player = await fetch(`https://cloudnestra.com/prorcp/${prorcp}`, 'https://cloudnestra.com/');
  const hiddenDiv = player.match(/<div[^>]+id="([^"]+)"[^>]+style="display:none;">([^<]+)<\/div>/);
  
  const encoded = hiddenDiv[2];
  
  console.log(`RAW ENCODED DATA (first 200 chars):\n${encoded.substring(0, 200)}\n\n`);
  
  // This looks like: eqqmp://qjpqo5.{s1}/mi/...
  // Which could be: https://putgate.io/...
  
  console.log('Analyzing character substitution...\n');
  
  // e -> h (shift of 3 backwards)
  // q -> t (shift of 3 backwards)
  // q -> t
  // m -> p
  // p -> s
  
  // Let's try shift of -3
  console.log('Trying shift of -3...\n');
  const shift3 = encoded.split('').map(c => {
    const code = c.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      return String.fromCharCode(((code - 65 - 3 + 26) % 26) + 65);
    } else if (code >= 97 && code <= 122) {
      return String.fromCharCode(((code - 97 - 3 + 26) % 26) + 97);
    }
    return c;
  }).join('');
  
  console.log(`Result (first 200 chars):\n${shift3.substring(0, 200)}\n\n`);
  
  if (shift3.includes('http')) {
    console.log('🎉 SHIFT -3 WORKED!\n');
    console.log('Full URL:\n');
    console.log(shift3);
    return shift3;
  }
  
  // Try all shifts
  console.log('Trying all possible shifts...\n');
  for (let shift = -25; shift <= 25; shift++) {
    if (shift === 0) continue;
    
    const shifted = encoded.split('').map(c => {
      const code = c.charCodeAt(0);
      if (code >= 65 && code <= 90) {
        return String.fromCharCode(((code - 65 + shift + 26) % 26) + 65);
      } else if (code >= 97 && code <= 122) {
        return String.fromCharCode(((code - 97 + shift + 26) % 26) + 97);
      }
      return c;
    }).join('');
    
    if (shifted.includes('http') || shifted.includes('.m3u8')) {
      console.log(`🎉 SHIFT ${shift} WORKED!\n`);
      console.log('Full URL:\n');
      console.log(shifted);
      return shifted;
    }
  }
  
  console.log('\n❌ Character shift did not work\n');
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

finalDiscovery().catch(console.error);
