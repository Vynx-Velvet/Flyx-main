/**
 * WORKING PURE FETCH M3U8 EXTRACTOR
 * 
 * After reverse engineering the 112KB obfuscated script,
 * we discovered the decryption is simply: atob(reverse(encodedData))
 */

const https = require('https');

async function extractM3U8(tmdbId, type = 'movie', season = null, episode = null) {
  console.log('🎬 EXTRACTING M3U8 URL\n');
  console.log('='.repeat(80) + '\n');
  
  try {
    // Step 1: Get VidSrc embed page
    let embedUrl = `https://vidsrc-embed.ru/embed/${type}/${tmdbId}`;
    if (type === 'tv' && season && episode) {
      embedUrl += `/${season}/${episode}`;
    }
    
    console.log(`1️⃣  Fetching VidSrc embed: ${embedUrl}\n`);
    const vidsrcPage = await fetch(embedUrl);
    
    // Extract data-hash
    const hashMatch = vidsrcPage.match(/data-hash="([^"]+)"/);
    if (!hashMatch) {
      throw new Error('Could not find data-hash');
    }
    const hash = hashMatch[1];
    console.log(`   ✅ Got hash: ${hash.substring(0, 50)}...\n`);
    
    // Step 2: Get RCP page
    console.log(`2️⃣  Fetching RCP page...\n`);
    const rcpUrl = `https://cloudnestra.com/rcp/${hash}`;
    const rcpPage = await fetch(rcpUrl, 'https://vidsrc-embed.ru/');
    
    // Extract prorcp path
    const prorcpMatch = rcpPage.match(/src:\s*['"]\/prorcp\/([^'"]+)['"]/);
    if (!prorcpMatch) {
      throw new Error('Could not find prorcp path');
    }
    const prorcp = prorcpMatch[1];
    console.log(`   ✅ Got prorcp: ${prorcp.substring(0, 50)}...\n`);
    
    // Step 3: Get ProRCP player page
    console.log(`3️⃣  Fetching ProRCP player page...\n`);
    const playerUrl = `https://cloudnestra.com/prorcp/${prorcp}`;
    const playerPage = await fetch(playerUrl, 'https://cloudnestra.com/');
    
    // Extract hidden div with encoded M3U8
    const hiddenDivMatch = playerPage.match(/<div[^>]+id="([^"]+)"[^>]+style="display:none;">([^<]+)<\/div>/);
    if (!hiddenDivMatch) {
      throw new Error('Could not find hidden div with encoded data');
    }
    
    const divId = hiddenDivMatch[1];
    const encodedData = hiddenDivMatch[2];
    
    console.log(`   ✅ Found hidden div: ${divId}`);
    console.log(`   ✅ Encoded data: ${encodedData.substring(0, 80)}...\n`);
    
    // Step 4: DECRYPT THE M3U8 URL
    console.log(`4️⃣  Decrypting M3U8 URL...\n`);
    console.log(`   Algorithm: atob(reverse(encodedData))\n`);
    
    // Reverse the string
    const reversed = encodedData.split('').reverse().join('');
    
    // Base64 decode
    const decoded = Buffer.from(reversed, 'base64').toString('utf8');
    
    console.log(`   ✅ Decoded: ${decoded}\n\n`);
    
    // The decoded string should be the M3U8 URL
    if (decoded.includes('.m3u8') || decoded.includes('http')) {
      console.log('🎉 SUCCESS! M3U8 URL:\n');
      console.log(decoded);
      console.log('\n');
      return decoded;
    } else {
      console.log('⚠️  Decoded data does not look like an M3U8 URL');
      console.log('   It might be further encoded or the algorithm changed\n');
      console.log(`   Raw decoded: ${decoded}\n`);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    return null;
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

// Test with Fight Club
if (require.main === module) {
  extractM3U8(550, 'movie').catch(console.error);
}

module.exports = { extractM3U8 };
