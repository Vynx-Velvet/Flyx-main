/**
 * DEEP PATTERN ANALYSIS
 * 
 * Analyze the exact encoding pattern used
 */

const https = require('https');

async function deepPatternAnalysis() {
  console.log('🔬 DEEP PATTERN ANALYSIS\n');
  console.log('='.repeat(80) + '\n');
  
  const vidsrc = await fetch('https://vidsrc-embed.ru/embed/movie/550');
  const hash = vidsrc.match(/data-hash="([^"]+)"/)[1];
  
  const rcp = await fetch(`https://cloudnestra.com/rcp/${hash}`, 'https://vidsrc-embed.ru/');
  const prorcp = rcp.match(/src:\s*['"]\/prorcp\/([^'"]+)['"]/)[1];
  
  const player = await fetch(`https://cloudnestra.com/prorcp/${prorcp}`, 'https://cloudnestra.com/');
  const hiddenDiv = player.match(/<div[^>]+id="([^"]+)"[^>]+style="display:none;">([^<]+)<\/div>/);
  
  const encoded = hiddenDiv[2];
  
  console.log(`Encoded data length: ${encoded.length}`);
  console.log(`First 200 chars: ${encoded.substring(0, 200)}\n\n`);
  
  // Analyze character frequency
  const charFreq = {};
  for (let char of encoded) {
    charFreq[char] = (charFreq[char] || 0) + 1;
  }
  
  const sorted = Object.entries(charFreq).sort((a, b) => b[1] - a[1]);
  console.log('Character frequency (top 20):');
  sorted.slice(0, 20).forEach(([char, count]) => {
    console.log(`   '${char}' (${char.charCodeAt(0)}): ${count} times`);
  });
  
  // Check if it's a custom base64
  const standardBase64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  const charsInData = new Set(encoded);
  
  console.log(`\n\nUnique characters in data: ${charsInData.size}`);
  console.log('Characters:', Array.from(charsInData).sort().join(''));
  
  // Check if it matches standard base64 alphabet
  const nonBase64Chars = Array.from(charsInData).filter(c => !standardBase64.includes(c));
  console.log(`\nNon-standard base64 characters: ${nonBase64Chars.length}`);
  if (nonBase64Chars.length > 0 && nonBase64Chars.length < 20) {
    console.log('Characters:', nonBase64Chars.join(', '));
  }
  
  // Try custom base64 decode (they might have swapped characters)
  console.log('\n\nTrying custom base64 variants...\n');
  
  // Common base64 variants
  const variants = [
    { name: 'Standard', alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/' },
    { name: 'URL-safe', alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_' },
    { name: 'Reversed', alphabet: 'zyxwvutsrqponmlkjihgfedcbaZYXWVUTSRQPONMLKJIHGFEDCBA9876543210+/' },
  ];
  
  for (const variant of variants) {
    try {
      const decoded = customBase64Decode(encoded, variant.alphabet);
      if (decoded && (decoded.includes('http') || decoded.includes('.m3u8'))) {
        console.log(`🎉 ${variant.name} base64 WORKED!\n`);
        console.log(decoded);
        return decoded;
      }
    } catch (e) {
      // Continue
    }
  }
  
  // Check if the data starts with a recognizable pattern
  console.log('\n\nChecking for recognizable patterns...\n');
  
  // Look for patterns that might indicate the encoding
  const first20 = encoded.substring(0, 20);
  console.log(`First 20 chars: ${first20}`);
  
  // Try to detect if it's a substitution cipher
  // Standard base64 of "https://" would start with "aHR0cHM6Ly"
  // Let's see if we can map the characters
  
  console.log('\n\nTrying to map to known patterns...\n');
  
  // If this is "https://putgate..." encoded, let's try to find the mapping
  const knownUrls = [
    'https://putgate.io/',
    'https://putgate1.io/',
    'https://putgate2.io/',
    'https://putgate3.io/',
    'https://putgate4.io/',
    'https://putgate5.io/',
  ];
  
  for (const url of knownUrls) {
    const urlBase64 = Buffer.from(url).toString('base64');
    console.log(`\n${url}`);
    console.log(`  Standard base64: ${urlBase64}`);
    console.log(`  Our data starts: ${encoded.substring(0, urlBase64.length)}`);
    
    // Try to find character mapping
    if (encoded.length >= urlBase64.length) {
      const mapping = {};
      let matches = 0;
      for (let i = 0; i < Math.min(urlBase64.length, 30); i++) {
        const expected = urlBase64[i];
        const actual = encoded[i];
        if (mapping[actual] && mapping[actual] !== expected) {
          // Conflict, not a simple substitution
          break;
        }
        mapping[actual] = expected;
        matches++;
      }
      
      if (matches > 10) {
        console.log(`  Possible mapping found (${matches} chars):`);
        console.log(`  `, JSON.stringify(mapping));
        
        // Try to decode with this mapping
        const decoded = encoded.split('').map(c => mapping[c] || c).join('');
        try {
          const result = Buffer.from(decoded, 'base64').toString('utf8');
          if (result.includes('http') || result.includes('.m3u8')) {
            console.log(`\n🎉 MAPPING WORKED!\n`);
            console.log(result);
            return result;
          }
        } catch (e) {
          // Not valid
        }
      }
    }
  }
  
  console.log('\n\n❌ Pattern analysis did not find the encoding\n');
}

function customBase64Decode(data, alphabet) {
  const standard = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  
  // Create mapping
  const mapping = {};
  for (let i = 0; i < alphabet.length; i++) {
    mapping[alphabet[i]] = standard[i];
  }
  
  // Translate
  const translated = data.split('').map(c => mapping[c] || c).join('');
  
  // Decode
  return Buffer.from(translated, 'base64').toString('utf8');
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

deepPatternAnalysis().catch(console.error);
