/**
 * SINGLE MOVIE TEST
 * Test just Fight Club (550) with detailed debugging
 */

const https = require('https');

async function testSingleMovie() {
  console.log('🎬 Testing Fight Club (TMDB: 550)\n');
  console.log('='.repeat(80) + '\n');
  
  const tmdbId = 550;
  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${tmdbId}`;
  
  try {
    // Step 1: Get embed page
    console.log('Step 1: Fetching embed page...');
    console.log(`URL: ${embedUrl}\n`);
    
    const embedPage = await fetch(embedUrl);
    console.log(`✅ Got embed page (${embedPage.length} bytes)\n`);
    
    // Extract hash
    console.log('Step 2: Extracting hash...');
    const hashMatch = embedPage.match(/data-hash="([^"]+)"/);
    
    if (!hashMatch) {
      console.log('❌ No hash found!');
      console.log('Searching for alternative patterns...\n');
      
      // Try other patterns
      const altPatterns = [
        /hash["\']?\s*[:=]\s*["']([^"']+)["']/,
        /["']hash["']\s*:\s*["']([^"']+)["']/,
        /data-id="([^"]+)"/
      ];
      
      for (const pattern of altPatterns) {
        const match = embedPage.match(pattern);
        if (match) {
          console.log(`✅ Found with alternative pattern: ${match[1].substring(0, 50)}...\n`);
          break;
        }
      }
      
      // Show a sample of the page
      console.log('Sample of embed page:');
      console.log(embedPage.substring(0, 500));
      return;
    }
    
    const hash = hashMatch[1];
    console.log(`✅ Hash: ${hash}\n`);
    
    // Step 2: Get RCP page
    console.log('Step 3: Fetching RCP page...');
    const rcpUrl = `https://cloudnestra.com/rcp/${hash}`;
    console.log(`URL: ${rcpUrl}\n`);
    
    const rcpPage = await fetch(rcpUrl, embedUrl);
    console.log(`✅ Got RCP page (${rcpPage.length} bytes)\n`);
    
    // Extract prorcp
    console.log('Step 4: Extracting prorcp...');
    const prorcpMatch = rcpPage.match(/\/prorcp\/([A-Za-z0-9+\/=\-_]+)/);
    
    if (!prorcpMatch) {
      console.log('❌ No prorcp found!');
      console.log('Sample of RCP page:');
      console.log(rcpPage.substring(0, 500));
      return;
    }
    
    const prorcp = prorcpMatch[1];
    console.log(`✅ ProRCP: ${prorcp.substring(0, 50)}...\n`);
    
    // Step 3: Get player page
    console.log('Step 5: Fetching player page...');
    const playerUrl = `https://cloudnestra.com/prorcp/${prorcp}`;
    console.log(`URL: ${playerUrl}\n`);
    
    const playerPage = await fetch(playerUrl, rcpUrl);
    console.log(`✅ Got player page (${playerPage.length} bytes)\n`);
    
    // Extract hidden div
    console.log('Step 6: Extracting hidden div...');
    const hiddenDivMatch = playerPage.match(
      /<div[^>]+id="([^"]+)"[^>]+style="display:none;">([^<]+)<\/div>/
    );
    
    if (!hiddenDivMatch) {
      console.log('❌ No hidden div found!');
      console.log('Searching for alternative patterns...\n');
      
      // Try other patterns
      const altDivPatterns = [
        /<div[^>]+style="display:none;"[^>]+id="([^"]+)"[^>]*>([^<]+)<\/div>/,
        /<div[^>]+id="([^"]+)"[^>]*>([^<]+)<\/div>/
      ];
      
      for (const pattern of altDivPatterns) {
        const match = playerPage.match(pattern);
        if (match) {
          console.log(`✅ Found with alternative pattern!`);
          console.log(`Div ID: ${match[1]}`);
          console.log(`Encoded: ${match[2].substring(0, 80)}...\n`);
          break;
        }
      }
      
      console.log('Sample of player page:');
      console.log(playerPage.substring(0, 1000));
      return;
    }
    
    const divId = hiddenDivMatch[1];
    const encoded = hiddenDivMatch[2];
    
    console.log(`✅ Div ID: ${divId}`);
    console.log(`✅ Encoded: ${encoded.substring(0, 80)}...\n`);
    
    // Step 4: Decode
    console.log('Step 7: Decoding with Caesar -3...');
    const decoded = caesarDecode(encoded, -3);
    
    console.log(`Decoded: ${decoded.substring(0, 100)}...\n`);
    
    if (decoded.includes('http')) {
      console.log('🎉 SUCCESS!\n');
      console.log('Full M3U8 URL:');
      console.log(decoded);
      return decoded;
    } else {
      console.log('❌ Decoded but no valid URL found');
      console.log('Trying other Caesar shifts...\n');
      
      for (let shift = 1; shift <= 25; shift++) {
        const alt = caesarDecode(encoded, shift);
        if (alt.includes('http')) {
          console.log(`🎉 SUCCESS with shift ${shift}!\n`);
          console.log(alt);
          return alt;
        }
      }
      
      console.log('❌ No valid URL found with any Caesar shift');
    }
    
  } catch (error) {
    console.log(`\n❌ ERROR: ${error.message}`);
    console.log(error.stack);
  }
}

function caesarDecode(text, shift) {
  return text.split('').map(c => {
    const code = c.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      return String.fromCharCode(((code - 65 - shift + 26) % 26) + 65);
    } else if (code >= 97 && code <= 122) {
      return String.fromCharCode(((code - 97 - shift + 26) % 26) + 97);
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

testSingleMovie();
