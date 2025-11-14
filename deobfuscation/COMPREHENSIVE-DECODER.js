/**
 * COMPREHENSIVE M3U8 DECODER
 * 
 * After extensive reverse engineering, we discovered multiple encoding methods.
 * This decoder tries all of them.
 */

const https = require('https');

async function extractM3U8Comprehensive(tmdbId, type = 'movie', season = null, episode = null) {
  console.log('🎬 COMPREHENSIVE M3U8 EXTRACTOR\n');
  console.log('='.repeat(80) + '\n');
  
  try {
    // Get to the player page
    let embedUrl = `https://vidsrc-embed.ru/embed/${type}/${tmdbId}`;
    if (type === 'tv' && season && episode) {
      embedUrl += `/${season}/${episode}`;
    }
    
    console.log(`Fetching chain...\n`);
    const vidsrcPage = await fetch(embedUrl);
    const hash = vidsrcPage.match(/data-hash="([^"]+)"/)[1];
    
    const rcpPage = await fetch(`https://cloudnestra.com/rcp/${hash}`, 'https://vidsrc-embed.ru/');
    const prorcp = rcpPage.match(/src:\s*['"]\/prorcp\/([^'"]+)['"]/)[1];
    
    const playerPage = await fetch(`https://cloudnestra.com/prorcp/${prorcp}`, 'https://cloudnestra.com/');
    const hiddenDiv = playerPage.match(/<div[^>]+id="([^"]+)"[^>]+style="display:none;">([^<]+)<\/div>/);
    
    const encoded = hiddenDiv[2];
    console.log(`✅ Got encoded data: ${encoded.substring(0, 80)}...\n\n`);
    
    // Try all discovered decoding methods
    const methods = [
      { name: 'Reverse + Base64', fn: () => tryReverseBase64(encoded) },
      { name: 'Base64 only', fn: () => tryBase64(encoded) },
      { name: 'Reverse only', fn: () => encoded.split('').reverse().join('') },
      { name: 'Caesar -3', fn: () => tryCaesar(encoded, -3) },
      { name: 'Caesar +3', fn: () => tryCaesar(encoded, 3) },
      { name: 'All Caesar shifts', fn: () => tryAllCaesar(encoded) },
      { name: 'Hex decode', fn: () => tryHex(encoded) },
      { name: 'Reverse + Hex', fn: () => tryHex(encoded.split('').reverse().join('')) },
      { name: 'ROT13', fn: () => tryROT13(encoded) },
      { name: 'XOR common keys', fn: () => tryXOR(encoded) },
      { name: 'No decoding (raw)', fn: () => encoded }
    ];
    
    console.log('Trying all decoding methods...\n');
    
    for (const method of methods) {
      try {
        const result = method.fn();
        if (result && (result.includes('http') || result.includes('.m3u8'))) {
          console.log(`🎉 SUCCESS with method: ${method.name}\n`);
          console.log('M3U8 URL:\n');
          console.log(result);
          return result;
        }
      } catch (e) {
        // Method failed, continue
      }
    }
    
    console.log('❌ All decoding methods failed\n');
    console.log('The encoding has likely changed again.\n');
    console.log('Raw encoded data:\n');
    console.log(encoded);
    
    return null;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

function tryReverseBase64(data) {
  const reversed = data.split('').reverse().join('');
  return Buffer.from(reversed, 'base64').toString('utf8');
}

function tryBase64(data) {
  return Buffer.from(data, 'base64').toString('utf8');
}

function tryCaesar(data, shift) {
  return data.split('').map(c => {
    const code = c.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      return String.fromCharCode(((code - 65 + shift + 26) % 26) + 65);
    } else if (code >= 97 && code <= 122) {
      return String.fromCharCode(((code - 97 + shift + 26) % 26) + 97);
    }
    return c;
  }).join('');
}

function tryAllCaesar(data) {
  for (let shift = 1; shift <= 25; shift++) {
    const result = tryCaesar(data, shift);
    if (result.includes('http') || result.includes('.m3u8')) {
      return result;
    }
  }
  return null;
}

function tryHex(data) {
  return Buffer.from(data, 'hex').toString('utf8');
}

function tryROT13(data) {
  return tryCaesar(data, 13);
}

function tryXOR(data) {
  const keys = ['cloudnestra', 'vidsrc', 'player', '1234567890'];
  
  for (const key of keys) {
    const result = data.split('').map((c, i) => {
      return String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length));
    }).join('');
    
    if (result.includes('http') || result.includes('.m3u8')) {
      return result;
    }
  }
  
  return null;
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

if (require.main === module) {
  extractM3U8Comprehensive(550, 'movie').catch(console.error);
}

module.exports = { extractM3U8Comprehensive };
