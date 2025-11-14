/**
 * CORRECT DECODER
 * 
 * Let's get the ACTUAL raw data and decode it correctly
 */

const https = require('https');

async function correctDecoder() {
  console.log('🔍 CORRECT DECODER\n');
  console.log('='.repeat(80) + '\n');
  
  const vidsrc = await fetch('https://vidsrc-embed.ru/embed/movie/550');
  const hash = vidsrc.match(/data-hash="([^"]+)"/)[1];
  
  const rcp = await fetch(`https://cloudnestra.com/rcp/${hash}`, 'https://vidsrc-embed.ru/');
  const prorcp = rcp.match(/src:\s*['"]\/prorcp\/([^'"]+)['"]/)[1];
  
  const player = await fetch(`https://cloudnestra.com/prorcp/${prorcp}`, 'https://cloudnestra.com/');
  const hiddenDiv = player.match(/<div[^>]+id="([^"]+)"[^>]+style="display:none;">([^<]+)<\/div>/);
  
  const encoded = hiddenDiv[2];
  
  console.log(`Encoded data:`);
  console.log(`  Length: ${encoded.length}`);
  console.log(`  First 100: ${encoded.substring(0, 100)}`);
  console.log(`  Last 100: ${encoded.substring(encoded.length - 100)}\n\n`);
  
  // Check what characters are in it
  const chars = new Set(encoded);
  console.log(`Unique characters (${chars.size}): ${Array.from(chars).sort().join('')}\n\n`);
  
  // This looks like base64! Let's try all the methods we discovered:
  
  const methods = [
    {
      name: 'Direct base64',
      fn: () => Buffer.from(encoded, 'base64').toString('utf8')
    },
    {
      name: 'Reverse then base64',
      fn: () => {
        const reversed = encoded.split('').reverse().join('');
        return Buffer.from(reversed, 'base64').toString('utf8');
      }
    },
    {
      name: 'Base64 then reverse',
      fn: () => {
        const decoded = Buffer.from(encoded, 'base64').toString('utf8');
        return decoded.split('').reverse().join('');
      }
    },
    {
      name: 'URL decode then base64',
      fn: () => {
        const urlDecoded = decodeURIComponent(encoded);
        return Buffer.from(urlDecoded, 'base64').toString('utf8');
      }
    },
    {
      name: 'Replace chars then base64',
      fn: () => {
        // Try common base64 variant character replacements
        const replaced = encoded.replace(/-/g, '+').replace(/_/g, '/');
        return Buffer.from(replaced, 'base64').toString('utf8');
      }
    }
  ];
  
  console.log('Trying all decoding methods...\n');
  
  for (const method of methods) {
    try {
      const result = method.fn();
      
      console.log(`${method.name}:`);
      console.log(`  First 150 chars: ${result.substring(0, 150).replace(/[^\x20-\x7E]/g, '.')}`);
      
      if (result.includes('http') || result.includes('.m3u8') || result.includes('putgate')) {
        console.log(`\n🎉 SUCCESS!\n`);
        console.log('Full result:\n');
        console.log(result);
        return result;
      }
      console.log('');
      
    } catch (e) {
      console.log(`${method.name}: Error - ${e.message}\n`);
    }
  }
  
  console.log('\n❌ Standard methods failed. Analyzing the obfuscated functions more carefully...\n');
  
  // The GTAxQyTyBx function we extracted does:
  // 1. Split to array
  // 2. Reverse
  // 3. Join
  // 4. Loop and build string (no-op)
  // 5. atob (base64 decode)
  
  console.log('Applying the exact algorithm from GTAxQyTyBx function:\n');
  console.log('1. Split to array, reverse, join');
  console.log('2. atob (base64 decode)\n');
  
  try {
    const reversed = encoded.split('').reverse().join('');
    console.log(`Reversed: ${reversed.substring(0, 100)}...\n`);
    
    const decoded = Buffer.from(reversed, 'base64').toString('utf8');
    console.log(`Decoded: ${decoded.substring(0, 200)}\n`);
    
    if (decoded.includes('http') || decoded.includes('.m3u8')) {
      console.log('🎉 IT WORKED!\n');
      console.log(decoded);
      return decoded;
    }
    
  } catch (e) {
    console.log(`Error: ${e.message}\n`);
  }
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

correctDecoder().catch(console.error);
