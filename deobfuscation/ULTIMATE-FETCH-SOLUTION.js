/**
 * ULTIMATE FETCH SOLUTION
 * 
 * After complete reverse engineering, the algorithm is:
 * M3U8 = atob(reverse(encodedData))
 * 
 * But the encodedData format varies. This tries all variants.
 */

const https = require('https');

async function extractM3U8Ultimate(tmdbId, type = 'movie', season = null, episode = null) {
  console.log('🎯 ULTIMATE M3U8 EXTRACTOR\n');
  console.log('='.repeat(80) + '\n');
  
  try {
    // Get to player page
    let embedUrl = `https://vidsrc-embed.ru/embed/${type}/${tmdbId}`;
    if (type === 'tv' && season && episode) {
      embedUrl += `/${season}/${episode}`;
    }
    
    const vidsrcPage = await fetch(embedUrl);
    const hash = vidsrcPage.match(/data-hash="([^"]+)"/)[1];
    
    const rcpPage = await fetch(`https://cloudnestra.com/rcp/${hash}`, 'https://vidsrc-embed.ru/');
    const prorcp = rcpPage.match(/src:\s*['"]\/prorcp\/([^'"]+)['"]/)[1];
    
    const playerPage = await fetch(`https://cloudnestra.com/prorcp/${prorcp}`, 'https://cloudnestra.com/');
    const hiddenDiv = playerPage.match(/<div[^>]+id="([^"]+)"[^>]+style="display:none;">([^<]+)<\/div>/);
    
    const divId = hiddenDiv[1];
    const encoded = hiddenDiv[2];
    
    console.log(`Div ID: ${divId}`);
    console.log(`Encoded: ${encoded.substring(0, 80)}...\n`);
    
    // THE CORE ALGORITHM: atob(reverse(data))
    // But we need to handle different data formats
    
    const decoders = [
      {
        name: 'Direct: atob(reverse(data))',
        fn: (data) => {
          const reversed = data.split('').reverse().join('');
          return Buffer.from(reversed, 'base64').toString('utf8');
        }
      },
      {
        name: 'Hex to UTF-8',
        fn: (data) => {
          return Buffer.from(data, 'hex').toString('utf8');
        }
      },
      {
        name: 'Hex then reverse',
        fn: (data) => {
          const hexDecoded = Buffer.from(data, 'hex').toString('utf8');
          return hexDecoded.split('').reverse().join('');
        }
      },
      {
        name: 'Hex then atob(reverse())',
        fn: (data) => {
          const hexDecoded = Buffer.from(data, 'hex').toString('utf8');
          const reversed = hexDecoded.split('').reverse().join('');
          return Buffer.from(reversed, 'base64').toString('utf8');
        }
      },
      {
        name: 'Reverse hex then decode',
        fn: (data) => {
          const reversed = data.split('').reverse().join('');
          return Buffer.from(reversed, 'hex').toString('utf8');
        }
      },
      {
        name: 'atob(data) - no reverse',
        fn: (data) => {
          return Buffer.from(data, 'base64').toString('utf8');
        }
      },
      {
        name: 'Reverse only - no atob',
        fn: (data) => {
          return data.split('').reverse().join('');
        }
      },
      {
        name: 'URL decode then atob(reverse())',
        fn: (data) => {
          const urlDecoded = decodeURIComponent(data);
          const reversed = urlDecoded.split('').reverse().join('');
          return Buffer.from(reversed, 'base64').toString('utf8');
        }
      }
    ];
    
    console.log('Trying all decoding methods...\n');
    
    for (const decoder of decoders) {
      try {
        const result = decoder.fn(encoded);
        
        if (result && (result.includes('http') || result.includes('.m3u8') || result.includes('putgate'))) {
          console.log(`🎉 SUCCESS with: ${decoder.name}\n`);
          console.log('M3U8 URL:\n');
          console.log(result);
          return result;
        }
      } catch (e) {
        // Continue to next method
      }
    }
    
    console.log('❌ All methods failed\n');
    console.log('The encoding format has changed again.\n');
    console.log(`Raw data: ${encoded.substring(0, 200)}...\n`);
    
    return null;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
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

if (require.main === module) {
  extractM3U8Ultimate(550, 'movie').then(url => {
    if (url) {
      console.log('\n✅ EXTRACTION SUCCESSFUL\n');
      console.log('This is the working pure-fetch solution!');
    } else {
      console.log('\n⚠️  Extraction failed - encoding format may have changed');
      console.log('The site uses rotating encryption to prevent scraping');
    }
  }).catch(console.error);
}

module.exports = { extractM3U8Ultimate };
