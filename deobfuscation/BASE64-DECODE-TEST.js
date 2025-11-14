/**
 * BASE64 DECODE TEST
 * The data starts with == which suggests base64
 */

const https = require('https');

async function base64DecodeTest() {
  console.log('🔍 Base64 Decode Test\n');
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
  console.log(`Encoded: ${encoded.substring(0, 100)}...\n`);
  console.log(`Starts with: "${encoded.substring(0, 10)}"`);
  console.log(`Ends with: "${encoded.substring(encoded.length - 10)}"\n`);
  
  // The data looks like reversed base64
  console.log('Trying reversed base64...');
  const reversed = encoded.split('').reverse().join('');
  console.log(`Reversed starts with: "${reversed.substring(0, 20)}"`);
  
  try {
    const decoded = Buffer.from(reversed, 'base64').toString('utf8');
    console.log(`\nDecoded: ${decoded.substring(0, 200)}...\n`);
    
    if (decoded.includes('http')) {
      console.log('🎉 SUCCESS! Found URL in reversed base64!\n');
      console.log('Full URL:');
      console.log(decoded);
      return decoded;
    } else {
      console.log('Decoded but no URL found. Trying Caesar shifts on decoded...\n');
      
      for (let shift = 1; shift <= 25; shift++) {
        const caesar = caesarDecode(decoded, shift);
        if (caesar.includes('http')) {
          console.log(`🎉 SUCCESS with Caesar shift ${shift} after base64!\n`);
          console.log(caesar);
          return caesar;
        }
      }
    }
  } catch (e) {
    console.log(`Failed: ${e.message}`);
  }
  
  console.log('\n❌ Reversed base64 didn\'t work');
}

function caesarDecode(text, shift) {
  return text.split('').map(c => {
    const code = c.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      return String.fromCharCode(((code - 65 + shift) % 26) + 65);
    } else if (code >= 97 && code <= 122) {
      return String.fromCharCode(((code - 97 + shift) % 26) + 97);
    }
    return c;
  }).join('');
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

base64DecodeTest();
