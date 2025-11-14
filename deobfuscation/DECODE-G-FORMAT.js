/**
 * DECODE G-FORMAT
 * The encoding uses 0-9, :, and 'g' as special character
 * Maybe 'g' represents something like 'a' in hex (10)?
 */

const https = require('https');

async function decodeGFormat() {
  console.log('🔍 Decoding G-Format\n');
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
  console.log(`Encoded: ${encoded.substring(0, 200)}...\n`);
  
  // Theory 1: 'g' represents 'a' (10 in hex)
  console.log('Theory 1: g = a (hex 10)');
  const hex1 = encoded.replace(/g/g, 'a').replace(/:/g, '');
  try {
    const decoded1 = Buffer.from(hex1, 'hex').toString('utf8');
    console.log(`Result: ${decoded1.substring(0, 100)}...`);
    if (decoded1.includes('http')) {
      console.log('🎉 SUCCESS!\n');
      console.log(decoded1);
      return decoded1;
    }
  } catch (e) {
    console.log(`Failed: ${e.message}`);
  }
  
  // Theory 2: ':' is separator, 'g' is special
  console.log('\nTheory 2: Split by : and decode each part');
  const parts = encoded.split(':');
  console.log(`Parts: ${parts.length}`);
  for (let i = 0; i < Math.min(5, parts.length); i++) {
    console.log(`Part ${i}: ${parts[i].substring(0, 50)}...`);
  }
  
  // Theory 3: 'g' = 'f' (15 in hex)
  console.log('\nTheory 3: g = f (hex 15)');
  const hex3 = encoded.replace(/g/g, 'f').replace(/:/g, '');
  try {
    const decoded3 = Buffer.from(hex3, 'hex').toString('utf8');
    console.log(`Result: ${decoded3.substring(0, 100)}...`);
    if (decoded3.includes('http')) {
      console.log('🎉 SUCCESS!\n');
      console.log(decoded3);
      return decoded3;
    }
  } catch (e) {
    console.log(`Failed: ${e.message}`);
  }
  
  // Theory 4: It's octal with 'g' as separator
  console.log('\nTheory 4: Octal encoding');
  const octalParts = encoded.split('g');
  try {
    const decoded4 = octalParts.map(p => {
      if (!p) return '';
      return String.fromCharCode(parseInt(p.replace(/:/g, ''), 8));
    }).join('');
    console.log(`Result: ${decoded4.substring(0, 100)}...`);
    if (decoded4.includes('http')) {
      console.log('🎉 SUCCESS!\n');
      console.log(decoded4);
      return decoded4;
    }
  } catch (e) {
    console.log(`Failed: ${e.message}`);
  }
  
  // Theory 5: Custom base with g=10
  console.log('\nTheory 5: Custom base-11 (0-9, g=10)');
  try {
    const base11 = encoded.replace(/:/g, '').split('').map(c => {
      if (c === 'g') return 10;
      return parseInt(c);
    });
    
    // Try to decode as character codes
    let result = '';
    for (let i = 0; i < base11.length - 1; i += 2) {
      const charCode = base11[i] * 11 + base11[i + 1];
      if (charCode >= 32 && charCode <= 126) {
        result += String.fromCharCode(charCode);
      }
    }
    console.log(`Result: ${result.substring(0, 100)}...`);
    if (result.includes('http')) {
      console.log('🎉 SUCCESS!\n');
      console.log(result);
      return result;
    }
  } catch (e) {
    console.log(`Failed: ${e.message}`);
  }
  
  // Theory 6: ROT with offset
  console.log('\nTheory 6: Character substitution cipher');
  const alphabet = '0123456789:g';
  const target = 'abcdefghijkl';
  let subst = encoded;
  for (let i = 0; i < alphabet.length; i++) {
    subst = subst.split(alphabet[i]).join(target[i]);
  }
  console.log(`Result: ${subst.substring(0, 100)}...`);
  if (subst.includes('http')) {
    console.log('🎉 SUCCESS!\n');
    console.log(subst);
    return subst;
  }
  
  console.log('\n❌ All theories failed');
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

decodeGFormat();
