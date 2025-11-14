/**
 * FINAL ALL PROVIDERS EXTRACTOR - WORKING VERSION
 * 
 * Extracts from ALL providers using BOTH TMDB and IMDB IDs
 */

const https = require('https');
const zlib = require('zlib');

// BOTH IDs needed!
const TMDB_ID = '278';
const IMDB_ID = 'tt0111161';

async function extractAllSources() {
  console.log('🎬 FINAL ALL PROVIDERS EXTRACTOR\n');
  console.log('='.repeat(80) + '\n');
  console.log(`TMDB ID: ${TMDB_ID}`);
  console.log(`IMDB ID: ${IMDB_ID}\n`);
  
  const allSources = [];
  
  // Provider configurations
  const providers = [
    {
      name: 'VidSrc.xyz (TMDB)',
      embedUrl: `https://vidsrc.xyz/embed/movie/${TMDB_ID}`,
      method: 'hash-decode'
    },
    {
      name: 'VidSrc.xyz (IMDB)',
      embedUrl: `https://vidsrc.xyz/embed/movie/${IMDB_ID}`,
      method: 'hash-decode'
    },
    {
      name: '2Embed.cc VSRC (IMDB)',
      embedUrl: `https://streamsrcs.2embed.cc/vsrc?imdb=${IMDB_ID}`,
      method: 'hash-decode'
    },
    {
      name: '2Embed.cc VSRC (TMDB)',
      embedUrl: `https://streamsrcs.2embed.cc/vsrc?tmdb=${TMDB_ID}`,
      method: 'hash-decode'
    },
    {
      name: 'VidSrc.stream (TMDB)',
      embedUrl: `https://vidsrc.stream/embed/movie/${TMDB_ID}`,
      method: 'hash-decode'
    },
    {
      name: 'VidSrc.stream (IMDB)',
      embedUrl: `https://vidsrc.stream/embed/movie/${IMDB_ID}`,
      method: 'hash-decode'
    }
  ];
  
  // Extract from each provider
  for (const provider of providers) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`EXTRACTING FROM: ${provider.name}`);
    console.log('='.repeat(80) + '\n');
    
    try {
      const sources = await extractHashDecode(provider);
      
      if (sources.length > 0) {
        console.log(`✅ SUCCESS: Found ${sources.length} source(s)\n`);
        sources.forEach((src, i) => {
          console.log(`Source ${i + 1}:`);
          console.log(`  URL: ${src.url}`);
          console.log(`  Quality: ${src.quality}`);
          console.log('');
        });
        
        allSources.push(...sources.map(s => ({...s, provider: provider.name})));
      } else {
        console.log(`❌ FAILED: No sources found\n`);
      }
      
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}\n`);
    }
  }
  
  // Final summary
  console.log('\n' + '='.repeat(80));
  console.log('FINAL RESULTS');
  console.log('='.repeat(80) + '\n');
  
  console.log(`Total sources found: ${allSources.length}\n`);
  
  if (allSources.length > 0) {
    console.log('ALL SOURCES:\n');
    allSources.forEach((src, i) => {
      console.log(`${i + 1}. [${src.provider}]`);
      console.log(`   ${src.url}\n`);
    });
  } else {
    console.log('❌ NO SOURCES FOUND FROM ANY PROVIDER');
  }
  
  console.log('='.repeat(80));
  
  return allSources;
}

/**
 * Extract using hash-decode method
 */
async function extractHashDecode(provider) {
  const sources = [];
  
  try {
    // Step 1: Fetch embed page
    console.log(`Fetching: ${provider.embedUrl}`);
    const embedPage = await fetchPage(provider.embedUrl);
    console.log(`Page length: ${embedPage.length} bytes`);
    
    if (embedPage.length < 100) {
      throw new Error('Page too small or empty');
    }
    
    // Step 2: Extract hash
    const hashMatch = embedPage.match(/data-hash=["']([^"']+)["']/);
    if (!hashMatch) {
      throw new Error('No hash found');
    }
    
    const hash = hashMatch[1];
    console.log(`Hash: ${hash}`);
    
    // Step 3: Determine RCP endpoint
    let rcpUrl;
    if (provider.embedUrl.includes('vidsrc.xyz')) {
      rcpUrl = `https://vidsrc.net/rcp/${hash}`;
    } else if (provider.embedUrl.includes('vidsrc.stream')) {
      rcpUrl = `https://vidsrc.stream/rcp/${hash}`;
    } else if (provider.embedUrl.includes('streamsrcs.2embed.cc')) {
      rcpUrl = `https://streamsrcs.2embed.cc/rcp/${hash}`;
    } else {
      rcpUrl = `https://vidsrc.net/rcp/${hash}`;
    }
    
    console.log(`RCP URL: ${rcpUrl}`);
    
    // Step 4: Fetch RCP data
    const rcpData = await fetchPage(rcpUrl, provider.embedUrl);
    console.log(`RCP data length: ${rcpData.length} bytes`);
    
    // Step 5: Extract divId (decryption key)
    const divIdMatch = embedPage.match(/id=["']([^"']{10,})["']/);
    const divId = divIdMatch ? divIdMatch[1] : 'defaultKey';
    console.log(`DivId: ${divId}`);
    
    // Step 6: Decode the data
    const decoded = decodeData(rcpData, divId);
    console.log(`Decoded: ${decoded.substring(0, 200)}...`);
    
    // Step 7: Resolve placeholders
    const resolved = decoded
      .replace(/\{v1\}/g, 'shadowlandschronicles.com')
      .replace(/\{v2\}/g, 'shadowlandschronicles.net')
      .replace(/\{v3\}/g, 'shadowlandschronicles.io')
      .replace(/\{v4\}/g, 'shadowlandschronicles.org');
    
    // Step 8: Extract M3U8 URL
    const m3u8Match = resolved.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);
    if (m3u8Match) {
      sources.push({
        url: m3u8Match[0],
        quality: 'auto'
      });
    }
    
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
  
  return sources;
}

/**
 * Decode data using XOR cipher
 */
function decodeData(encodedData, key) {
  try {
    // Remove 'g' prefix if present
    let data = encodedData.startsWith('g') ? encodedData.substring(1) : encodedData;
    
    // Decode from base64
    const decoded = Buffer.from(data, 'base64');
    
    // Decompress gzip
    const decompressed = zlib.gunzipSync(decoded);
    
    // XOR decrypt
    const keyBytes = Buffer.from(key, 'utf-8');
    const decrypted = Buffer.alloc(decompressed.length);
    
    for (let i = 0; i < decompressed.length; i++) {
      decrypted[i] = decompressed[i] ^ keyBytes[i % keyBytes.length];
    }
    
    return decrypted.toString('utf-8');
  } catch (error) {
    console.log(`Decode error: ${error.message}`);
    return encodedData;
  }
}

/**
 * Fetch a page with proper headers
 */
function fetchPage(url, referer) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': referer || url
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Run the extractor
extractAllSources().then(sources => {
  console.log(`\n✅ Extraction complete! Found ${sources.length} total sources.`);
  process.exit(0);
}).catch(error => {
  console.error(`\n❌ Fatal error: ${error.message}`);
  process.exit(1);
});
