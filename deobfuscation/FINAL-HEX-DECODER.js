/**
 * FINAL HEX DECODER
 * 
 * The data is HEX encoded! Let's decode it properly.
 */

const https = require('https');

async function finalHexDecoder() {
  console.log('🎯 FINAL HEX DECODER\n');
  console.log('='.repeat(80) + '\n');
  
  const vidsrc = await fetch('https://vidsrc-embed.ru/embed/movie/550');
  const hash = vidsrc.match(/data-hash="([^"]+)"/)[1];
  
  const rcp = await fetch(`https://cloudnestra.com/rcp/${hash}`, 'https://vidsrc-embed.ru/');
  const prorcp = rcp.match(/src:\s*['"]\/prorcp\/([^'"]+)['"]/)[1];
  
  const player = await fetch(`https://cloudnestra.com/prorcp/${prorcp}`, 'https://cloudnestra.com/');
  const hiddenDiv = player.match(/<div[^>]+id="([^"]+)"[^>]+style="display:none;">([^<]+)<\/div>/);
  
  const encoded = hiddenDiv[2];
  
  console.log(`Encoded (hex): ${encoded.substring(0, 100)}...\n\n`);
  
  // Step 1: Decode from HEX to binary
  console.log('Step 1: Decoding from HEX...\n');
  const hexDecoded = Buffer.from(encoded, 'hex');
  console.log(`   Decoded ${hexDecoded.length} bytes\n`);
  
  // Step 2: Try different interpretations
  const methods = [
    {
      name: 'Direct UTF-8',
      fn: () => hexDecoded.toString('utf8')
    },
    {
      name: 'Base64 then UTF-8',
      fn: () => {
        const base64 = hexDecoded.toString('utf8');
        return Buffer.from(base64, 'base64').toString('utf8');
      }
    },
    {
      name: 'Reverse then Base64',
      fn: () => {
        const reversed = hexDecoded.toString('utf8').split('').reverse().join('');
        return Buffer.from(reversed, 'base64').toString('utf8');
      }
    },
    {
      name: 'Base64 (binary)',
      fn: () => {
        return Buffer.from(hexDecoded.toString('base64'), 'base64').toString('utf8');
      }
    },
    {
      name: 'Reverse bytes then UTF-8',
      fn: () => {
        return Buffer.from(hexDecoded.reverse()).toString('utf8');
      }
    }
  ];
  
  console.log('Trying different decoding methods...\n');
  
  for (const method of methods) {
    try {
      console.log(`Trying: ${method.name}...`);
      const result = method.fn();
      
      if (result && (result.includes('http') || result.includes('.m3u8') || result.includes('putgate'))) {
        console.log(`\n🎉 SUCCESS with ${method.name}!\n`);
        console.log('M3U8 URL:\n');
        console.log(result);
        return result;
      }
      
      // Show first 100 chars for debugging
      console.log(`   Result: ${result.substring(0, 100).replace(/[^\x20-\x7E]/g, '?')}...\n`);
      
    } catch (e) {
      console.log(`   Error: ${e.message}\n`);
    }
  }
  
  console.log('\n❌ All methods failed\n');
  
  // Show raw hex decoded as different encodings
  console.log('Raw hex decoded interpretations:\n');
  console.log(`UTF-8: ${hexDecoded.toString('utf8').substring(0, 200).replace(/[^\x20-\x7E]/g, '?')}`);
  console.log(`ASCII: ${hexDecoded.toString('ascii').substring(0, 200).replace(/[^\x20-\x7E]/g, '?')}`);
  console.log(`Latin1: ${hexDecoded.toString('latin1').substring(0, 200).replace(/[^\x20-\x7E]/g, '?')}`);
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

finalHexDecoder().catch(console.error);
