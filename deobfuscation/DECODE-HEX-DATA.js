/**
 * DECODE HEX DATA
 * 
 * The encoded data is HEX! Let's decode it properly
 */

const https = require('https');

async function decodeHex() {
  console.log('🔍 DECODING HEX DATA\n');
  console.log('='.repeat(80) + '\n');
  
  const vidsrc = await fetch('https://vidsrc-embed.ru/embed/movie/550');
  const hash = vidsrc.match(/data-hash="([^"]+)"/)[1];
  
  const rcp = await fetch(`https://cloudnestra.com/rcp/${hash}`, 'https://vidsrc-embed.ru/');
  const prorcp = rcp.match(/src:\s*['"]\/prorcp\/([^'"]+)['"]/)[1];
  
  const player = await fetch(`https://cloudnestra.com/prorcp/${prorcp}`, 'https://cloudnestra.com/');
  const hiddenDiv = player.match(/<div[^>]+id="([^"]+)"[^>]+style="display:none;">([^<]+)<\/div>/);
  
  const encoded = hiddenDiv[2];
  
  console.log(`Encoded (first 100 chars): ${encoded.substring(0, 100)}...\n\n`);
  
  // Decode from HEX
  console.log('Decoding from HEX...\n');
  const hexDecoded = Buffer.from(encoded, 'hex').toString('utf8');
  
  console.log(`HEX decoded (first 200 chars):\n${hexDecoded.substring(0, 200)}\n\n`);
  
  if (hexDecoded.includes('http') || hexDecoded.includes('.m3u8')) {
    console.log('🎉 HEX DECODING WORKED!\n');
    console.log('Full URL:\n');
    console.log(hexDecoded);
    return hexDecoded;
  }
  
  // Try reverse then hex
  console.log('Trying reverse then HEX...\n');
  const reversed = encoded.split('').reverse().join('');
  const hexReversed = Buffer.from(reversed, 'hex').toString('utf8');
  
  console.log(`Reversed HEX decoded (first 200 chars):\n${hexReversed.substring(0, 200)}\n\n`);
  
  if (hexReversed.includes('http') || hexReversed.includes('.m3u8')) {
    console.log('🎉 REVERSE + HEX WORKED!\n');
    console.log('Full URL:\n');
    console.log(hexReversed);
    return hexReversed;
  }
  
  console.log('\n❌ HEX decoding did not produce a URL\n');
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

decodeHex().catch(console.error);
