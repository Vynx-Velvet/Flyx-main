/**
 * ANALYZE NEW ENCODING FORMAT
 * The format changed from Caesar cipher to something else
 */

const https = require('https');

async function analyzeNewFormat() {
  console.log('🔍 Analyzing New Encoding Format\n');
  console.log('='.repeat(80) + '\n');
  
  const tmdbId = 550;
  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${tmdbId}`;
  
  const embedPage = await fetch(embedUrl);
  const hash = embedPage.match(/data-hash="([^"]+)"/)[1];
  
  const rcpUrl = `https://cloudnestra.com/rcp/${hash}`;
  const rcpPage = await fetch(rcpUrl, embedUrl);
  const prorcp = rcpPage.match(/\/prorcp\/([A-Za-z0-9+\/=\-_]+)/)[1];
  
  const playerUrl = `https://cloudnestra.com/prorcp/${prorcp}`;
  const playerPage = await fetch(playerUrl, rcpUrl);
  
  const hiddenDivMatch = playerPage.match(
    /<div[^>]+id="([^"]+)"[^>]+style="display:none;">([^<]+)<\/div>/
  );
  
  const divId = hiddenDivMatch[1];
  const encoded = hiddenDivMatch[2];
  
  console.log(`Div ID: ${divId}`);
  console.log(`Encoded length: ${encoded.length}`);
  console.log(`First 200 chars: ${encoded.substring(0, 200)}\n`);
  
  // Analyze the format
  console.log('Format Analysis:');
  console.log('-'.repeat(80));
  
  // Check if it's base64
  const base64Regex = /^[A-Za-z0-9+\/=]+$/;
  console.log(`Is Base64: ${base64Regex.test(encoded)}`);
  
  // Check if it's hex
  const hexRegex = /^[0-9a-fA-F]+$/;
  console.log(`Is Hex: ${hexRegex.test(encoded)}`);
  
  // Check character distribution
  const chars = {};
  for (const c of encoded) {
    chars[c] = (chars[c] || 0) + 1;
  }
  console.log(`\nUnique characters: ${Object.keys(chars).length}`);
  console.log(`Most common: ${Object.entries(chars).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c, n]) => `'${c}':${n}`).join(', ')}\n`);
  
  // Try different decodings
  console.log('Trying different decodings:');
  console.log('-'.repeat(80));
  
  // 1. Base64
  try {
    const b64 = Buffer.from(encoded, 'base64').toString('utf8');
    console.log(`Base64: ${b64.substring(0, 100)}...`);
    if (b64.includes('http')) {
      console.log('🎉 Base64 contains URL!');
      return b64;
    }
  } catch (e) {
    console.log(`Base64: Failed - ${e.message}`);
  }
  
  // 2. URL decode
  try {
    const urlDecoded = decodeURIComponent(encoded);
    console.log(`URL Decode: ${urlDecoded.substring(0, 100)}...`);
    if (urlDecoded.includes('http')) {
      console.log('🎉 URL decode contains URL!');
      return urlDecoded;
    }
  } catch (e) {
    console.log(`URL Decode: Failed - ${e.message}`);
  }
  
  // 3. Reverse
  const reversed = encoded.split('').reverse().join('');
  console.log(`Reversed: ${reversed.substring(0, 100)}...`);
  if (reversed.includes('http')) {
    console.log('🎉 Reversed contains URL!');
    return reversed;
  }
  
  // 4. XOR with div ID
  try {
    const buffer = Buffer.from(encoded);
    const xored = Buffer.alloc(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      xored[i] = buffer[i] ^ divId.charCodeAt(i % divId.length);
    }
    const xorResult = xored.toString('utf8');
    console.log(`XOR with divId: ${xorResult.substring(0, 100).replace(/[^\x20-\x7E]/g, '.')}...`);
    if (xorResult.includes('http')) {
      console.log('🎉 XOR contains URL!');
      return xorResult;
    }
  } catch (e) {
    console.log(`XOR: Failed - ${e.message}`);
  }
  
  // 5. ROT13
  const rot13 = encoded.replace(/[a-zA-Z]/g, c => {
    return String.fromCharCode((c <= 'Z' ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26);
  });
  console.log(`ROT13: ${rot13.substring(0, 100)}...`);
  if (rot13.includes('http')) {
    console.log('🎉 ROT13 contains URL!');
    return rot13;
  }
  
  // 6. Atbash cipher
  const atbash = encoded.split('').map(c => {
    if (c >= 'A' && c <= 'Z') {
      return String.fromCharCode(90 - (c.charCodeAt(0) - 65));
    } else if (c >= 'a' && c <= 'z') {
      return String.fromCharCode(122 - (c.charCodeAt(0) - 97));
    }
    return c;
  }).join('');
  console.log(`Atbash: ${atbash.substring(0, 100)}...`);
  if (atbash.includes('http')) {
    console.log('🎉 Atbash contains URL!');
    return atbash;
  }
  
  console.log('\n❌ None of the standard decodings worked');
  console.log('This appears to be a custom encoding scheme');
}

function fetch(url, referer = 'https://vidsrc-embed.ru/') {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': referer,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

analyzeNewFormat();
