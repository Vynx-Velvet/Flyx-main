/**
 * ANALYZE THE DECODED PATTERN
 * 
 * The atob(reverse()) gives us garbled data.
 * Let's analyze what additional encoding is used.
 */

const https = require('https');

async function analyzePattern() {
  console.log('🔍 ANALYZING DECODED PATTERN\n');
  console.log('='.repeat(80) + '\n');
  
  // Get fresh data
  const vidsrc = await fetch('https://vidsrc-embed.ru/embed/movie/550');
  const hash = vidsrc.match(/data-hash="([^"]+)"/)[1];
  
  const rcp = await fetch(`https://cloudnestra.com/rcp/${hash}`, 'https://vidsrc-embed.ru/');
  const prorcp = rcp.match(/src:\s*['"]\/prorcp\/([^'"]+)['"]/)[1];
  
  const player = await fetch(`https://cloudnestra.com/prorcp/${prorcp}`, 'https://cloudnestra.com/');
  const hiddenDiv = player.match(/<div[^>]+id="([^"]+)"[^>]+style="display:none;">([^<]+)<\/div>/);
  
  const encoded = hiddenDiv[2];
  
  console.log(`Encoded: ${encoded.substring(0, 100)}...\n\n`);
  
  // Try atob(reverse())
  const reversed = encoded.split('').reverse().join('');
  const decoded = Buffer.from(reversed, 'base64').toString('utf8');
  
  console.log(`Decoded (first 200 chars):\n${decoded.substring(0, 200)}\n\n`);
  
  // Analyze character patterns
  console.log('Character analysis:\n');
  const chars = {};
  for (let i = 0; i < Math.min(decoded.length, 1000); i++) {
    const char = decoded[i];
    const code = char.charCodeAt(0);
    if (!chars[code]) {
      chars[code] = { char, count: 0 };
    }
    chars[code].count++;
  }
  
  const sorted = Object.values(chars).sort((a, b) => b.count - a.count);
  console.log('Most common characters:');
  sorted.slice(0, 20).forEach(c => {
    console.log(`   ${c.char} (${c.char.charCodeAt(0)}): ${c.count} times`);
  });
  
  // Check if it looks like a URL pattern with character substitution
  console.log('\n\nLooking for URL patterns...\n');
  
  // Common URL patterns: http, https, .m3u8, ://
  // Let's see if we can find these with character shifts
  
  // Try ROT13
  console.log('Trying ROT13...\n');
  const rot13 = decoded.split('').map(c => {
    const code = c.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      return String.fromCharCode(((code - 65 + 13) % 26) + 65);
    } else if (code >= 97 && code <= 122) {
      return String.fromCharCode(((code - 97 + 13) % 26) + 97);
    }
    return c;
  }).join('');
  
  console.log(`ROT13 (first 200 chars):\n${rot13.substring(0, 200)}\n\n`);
  
  if (rot13.includes('http') || rot13.includes('.m3u8')) {
    console.log('🎉 ROT13 WORKED!\n');
    console.log(rot13);
    return;
  }
  
  // Try different character shifts
  console.log('Trying character shifts...\n');
  for (let shift = 1; shift <= 25; shift++) {
    const shifted = decoded.split('').map(c => {
      const code = c.charCodeAt(0);
      if (code >= 65 && code <= 90) {
        return String.fromCharCode(((code - 65 + shift) % 26) + 65);
      } else if (code >= 97 && code <= 122) {
        return String.fromCharCode(((code - 97 + shift) % 26) + 97);
      }
      return c;
    }).join('');
    
    if (shifted.includes('http') || shifted.includes('.m3u8')) {
      console.log(`🎉 SHIFT ${shift} WORKED!\n`);
      console.log(shifted.substring(0, 500));
      return;
    }
  }
  
  // Try XOR with common keys
  console.log('\nTrying XOR with common patterns...\n');
  const xorKeys = ['cloudnestra', 'vidsrc', 'player', '1234567890'];
  
  for (const key of xorKeys) {
    const xored = decoded.split('').map((c, i) => {
      return String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length));
    }).join('');
    
    if (xored.includes('http') || xored.includes('.m3u8')) {
      console.log(`🎉 XOR WITH "${key}" WORKED!\n`);
      console.log(xored.substring(0, 500));
      return;
    }
  }
  
  console.log('\n❌ No simple encoding found. The data might be compressed or use a custom cipher.\n');
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

analyzePattern().catch(console.error);
