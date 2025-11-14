/**
 * ALL METHODS DECODER
 * 
 * Tries every single decryption method observed across all testing
 * to maximize success rate
 */

const https = require('https');

async function extractWithAllMethods(tmdbId, type = 'movie', season = null, episode = null) {
  console.log('🔓 ALL METHODS DECODER\n');
  console.log('='.repeat(80) + '\n');
  
  // Build embed URL
  let embedUrl = `https://vidsrc-embed.ru/embed/${type}/${tmdbId}`;
  if (type === 'tv' && season && episode) {
    embedUrl += `/${season}/${episode}`;
  }
  
  console.log(`Testing: ${embedUrl}\n`);
  
  try {
    // Step 1: Get embed page
    const embedPage = await fetch(embedUrl);
    const hashMatch = embedPage.match(/data-hash="([^"]+)"/);
    if (!hashMatch) throw new Error('No hash found');
    const hash = hashMatch[1];
    console.log(`✅ Hash extracted\n`);
    
    // Step 2: Get RCP page
    const rcpUrl = `https://cloudnestra.com/rcp/${hash}`;
    const rcpPage = await fetch(rcpUrl, embedUrl);
    const prorcpMatch = rcpPage.match(/\/prorcp\/([A-Za-z0-9+\/=\-_]+)/);
    if (!prorcpMatch) throw new Error('No prorcp found');
    const prorcp = prorcpMatch[1];
    console.log(`✅ ProRCP extracted\n`);
    
    // Step 3: Get player page
    const playerUrl = `https://cloudnestra.com/prorcp/${prorcp}`;
    const playerPage = await fetch(playerUrl, rcpUrl);
    const hiddenDivMatch = playerPage.match(
      /<div[^>]+id="([^"]+)"[^>]+style="display:none;">([^<]+)<\/div>/
    );
    if (!hiddenDivMatch) throw new Error('No hidden div found');
    
    const divId = hiddenDivMatch[1];
    const encoded = hiddenDivMatch[2];
    
    console.log(`✅ Div ID: ${divId}`);
    console.log(`✅ Encoded data: ${encoded.substring(0, 80)}...\n`);
    console.log(`Trying all ${ALL_DECODERS.length} decryption methods...\n`);
    
    // Try all decoders
    for (let i = 0; i < ALL_DECODERS.length; i++) {
      const decoder = ALL_DECODERS[i];
      try {
        const result = decoder.fn(encoded, divId);
        
        if (result && typeof result === 'string' && result.includes('http')) {
          console.log(`\n🎉 SUCCESS with method ${i + 1}: ${decoder.name}\n`);
          console.log(`Decoded URL: ${result.substring(0, 150)}...\n`);
          return result;
        }
      } catch (e) {
        // Silent fail, continue to next method
      }
    }
    
    console.log('❌ All decryption methods failed\n');
    return null;
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}\n`);
    return null;
  }
}

// ALL OBSERVED DECRYPTION METHODS
const ALL_DECODERS = [
  // 1. Caesar cipher -3 (eqqmp:// format)
  {
    name: 'Caesar -3',
    fn: (data) => {
      return data.split('').map(c => {
        const code = c.charCodeAt(0);
        if (code >= 65 && code <= 90) {
          return String.fromCharCode(((code - 65 - 3 + 26) % 26) + 65);
        } else if (code >= 97 && code <= 122) {
          return String.fromCharCode(((code - 97 - 3 + 26) % 26) + 97);
        }
        return c;
      }).join('');
    }
  },
  
  // 2-26. All Caesar shifts
  ...Array.from({length: 25}, (_, i) => ({
    name: `Caesar ${i + 1}`,
    fn: (data) => {
      const shift = i + 1;
      return data.split('').map(c => {
        const code = c.charCodeAt(0);
        if (code >= 65 && code <= 90) {
          return String.fromCharCode(((code - 65 + shift) % 26) + 65);
        } else if (code >= 97 && code <= 122) {
          return String.fromCharCode(((code - 97 + shift) % 26) + 97);
        }
        return c;
      }).join('');
    }
  })),
  
  // 27. Base64 decode
  {
    name: 'Base64',
    fn: (data) => Buffer.from(data, 'base64').toString('utf8')
  },
  
  // 28. Base64 reverse then decode
  {
    name: 'Base64 Reversed',
    fn: (data) => {
      const reversed = data.split('').reverse().join('');
      return Buffer.from(reversed, 'base64').toString('utf8');
    }
  },
  
  // 29. Hex decode
  {
    name: 'Hex',
    fn: (data) => Buffer.from(data, 'hex').toString('utf8')
  },
  
  // 30. Hex with 'g' = 'a'
  {
    name: 'Hex (g=a)',
    fn: (data) => {
      const hex = data.replace(/g/g, 'a').replace(/:/g, '');
      return Buffer.from(hex, 'hex').toString('utf8');
    }
  },
  
  // 31. Hex with 'g' = 'f'
  {
    name: 'Hex (g=f)',
    fn: (data) => {
      const hex = data.replace(/g/g, 'f').replace(/:/g, '');
      return Buffer.from(hex, 'hex').toString('utf8');
    }
  },
  
  // 32. XOR with div ID
  {
    name: 'XOR with Div ID',
    fn: (data, divId) => {
      const buffer = Buffer.from(data);
      const xored = Buffer.alloc(buffer.length);
      for (let i = 0; i < buffer.length; i++) {
        xored[i] = buffer[i] ^ divId.charCodeAt(i % divId.length);
      }
      return xored.toString('utf8');
    }
  },
  
  // 33. XOR with div ID on base64
  {
    name: 'XOR with Div ID (Base64)',
    fn: (data, divId) => {
      const buffer = Buffer.from(data, 'base64');
      const xored = Buffer.alloc(buffer.length);
      for (let i = 0; i < buffer.length; i++) {
        xored[i] = buffer[i] ^ divId.charCodeAt(i % divId.length);
      }
      return xored.toString('utf8');
    }
  },
  
  // 34. ROT13
  {
    name: 'ROT13',
    fn: (data) => {
      return data.replace(/[a-zA-Z]/g, c => {
        return String.fromCharCode((c <= 'Z' ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26);
      });
    }
  },
  
  // 35. Atbash cipher
  {
    name: 'Atbash',
    fn: (data) => {
      return data.split('').map(c => {
        if (c >= 'A' && c <= 'Z') {
          return String.fromCharCode(90 - (c.charCodeAt(0) - 65));
        } else if (c >= 'a' && c <= 'z') {
          return String.fromCharCode(122 - (c.charCodeAt(0) - 97));
        }
        return c;
      }).join('');
    }
  },
  
  // 36. Reverse only
  {
    name: 'Reverse',
    fn: (data) => data.split('').reverse().join('')
  },
  
  // 37. URL decode
  {
    name: 'URL Decode',
    fn: (data) => decodeURIComponent(data)
  },
  
  // 38. Base64 + Caesar -3
  {
    name: 'Base64 + Caesar -3',
    fn: (data) => {
      const b64 = Buffer.from(data, 'base64').toString('utf8');
      return b64.split('').map(c => {
        const code = c.charCodeAt(0);
        if (code >= 65 && code <= 90) {
          return String.fromCharCode(((code - 65 - 3 + 26) % 26) + 65);
        } else if (code >= 97 && code <= 122) {
          return String.fromCharCode(((code - 97 - 3 + 26) % 26) + 97);
        }
        return c;
      }).join('');
    }
  },
  
  // 39. Reverse + Base64
  {
    name: 'Reverse + Base64',
    fn: (data) => {
      const reversed = data.split('').reverse().join('');
      return Buffer.from(reversed, 'base64').toString('utf8');
    }
  },
  
  // 40. Reverse + Caesar -3
  {
    name: 'Reverse + Caesar -3',
    fn: (data) => {
      const reversed = data.split('').reverse().join('');
      return reversed.split('').map(c => {
        const code = c.charCodeAt(0);
        if (code >= 65 && code <= 90) {
          return String.fromCharCode(((code - 65 - 3 + 26) % 26) + 65);
        } else if (code >= 97 && code <= 122) {
          return String.fromCharCode(((code - 97 - 3 + 26) % 26) + 97);
        }
        return c;
      }).join('');
    }
  },
  
  // 41-65. Base64 + All Caesar shifts
  ...Array.from({length: 25}, (_, i) => ({
    name: `Base64 + Caesar ${i + 1}`,
    fn: (data) => {
      const b64 = Buffer.from(data, 'base64').toString('utf8');
      const shift = i + 1;
      return b64.split('').map(c => {
        const code = c.charCodeAt(0);
        if (code >= 65 && code <= 90) {
          return String.fromCharCode(((code - 65 + shift) % 26) + 65);
        } else if (code >= 97 && code <= 122) {
          return String.fromCharCode(((code - 97 + shift) % 26) + 97);
        }
        return c;
      }).join('');
    }
  })),
  
  // 66. Direct return (no encoding)
  {
    name: 'No Encoding',
    fn: (data) => data
  }
];

function fetch(url, referer = 'https://vidsrc-embed.ru/') {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': referer,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Test with Fight Club
if (require.main === module) {
  console.log('Testing with Fight Club (TMDB: 550)\n');
  extractWithAllMethods(550, 'movie').then(url => {
    if (url) {
      console.log('✅ EXTRACTION SUCCESSFUL!\n');
      console.log('Full URL:');
      console.log(url);
    } else {
      console.log('❌ Extraction failed with all methods');
    }
  }).catch(console.error);
}

module.exports = { extractWithAllMethods, ALL_DECODERS };
