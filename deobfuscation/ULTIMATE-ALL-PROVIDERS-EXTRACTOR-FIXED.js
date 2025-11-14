/**
 * ULTIMATE ALL PROVIDERS EXTRACTOR - FIXED
 * 
 * Single script that returns EVERY source from EVERY provider
 * USING CORRECT TMDB ID (NOT IMDB ID!)
 */

const https = require('https');
const zlib = require('zlib');

// CORRECT TMDB ID for Shawshank Redemption
const TMDB_ID = '278'; // NOT tt0111161 (that's IMDB)

async function extractAllSources() {
  console.log('🎬 ULTIMATE ALL PROVIDERS EXTRACTOR\n');
  console.log('='.repeat(80) + '\n');
  console.log(`Testing TMDB ID: ${TMDB_ID} (Shawshank Redemption)\n`);
  
  const allSources = [];
  
  // Provider configurations
  const providers = [
    {
      name: 'VidSrc.xyz',
      embedUrl: `https://vidsrc.xyz/embed/movie/${TMDB_ID}`,
      method: 'hash-decode'
    },
    {
      name: 'VidSrc.stream',
      embedUrl: `https://vidsrc.stream/embed/movie/${TMDB_ID}`,
      method: 'hash-decode'
    },
    {
      name: '2Embed.cc',
      embedUrl: `https://www.2embed.cc/embed/tmdb/movie?id=${TMDB_ID}`,
      method: 'hash-decode'
    },
    {
      name: '2Embed.org',
      embedUrl: `https://2embed.org/embed/tmdb/movie?id=${TMDB_ID}`,
      method: 'iframe-chain'
    },
    {
      name: 'Multiembed',
      embedUrl: `https://multiembed.mov/?video_id=${TMDB_ID}&tmdb=1`,
      method: 'player-config'
    },
    {
      name: 'Smashystream',
      embedUrl: `https://embed.smashystream.com/playere.php?tmdb=${TMDB_ID}`,
      method: 'player-config'
    }
  ];
  
  // Extract from each provider
  for (const provider of providers) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`EXTRACTING FROM: ${provider.name}`);
    console.log('='.repeat(80) + '\n');
    
    try {
      let sources = [];
      
      if (provider.method === 'hash-decode') {
        sources = await extractHashDecode(provider);
      } else if (provider.method === 'iframe-chain') {
        sources = await extractIframeChain(provider);
      } else if (provider.method === 'player-config') {
        sources = await extractPlayerConfig(provider);
      }
      
      if (sources.length > 0) {
        console.log(`✅ SUCCESS: Found ${sources.length} source(s)\n`);
        sources.forEach((src, i) => {
          console.log(`Source ${i + 1}:`);
          console.log(`  URL: ${src.url}`);
          console.log(`  Quality: ${src.quality}`);
          console.log(`  Provider: ${provider.name}`);
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
      console.log(`${i + 1}. [${src.provider}] ${src.url}`);
    });
  } else {
    console.log('❌ NO SOURCES FOUND FROM ANY PROVIDER');
  }
  
  console.log('\n' + '='.repeat(80));
  
  return allSources;
}

/**
 * Extract using hash-decode method (VidSrc, 2Embed)
 */
async function extractHashDecode(provider) {
  const sources = [];
  
  try {
    // Step 1: Fetch embed page
    console.log(`Fetching: ${provider.embedUrl}`);
    const embedPage = await fetchPage(provider.embedUrl);
    console.log(`Page length: ${embedPage.length} bytes`);
    
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
    } else if (provider.embedUrl.includes('2embed.cc')) {
      // Extract swish ID from iframe
      const iframeMatch = embedPage.match(/streamsrcs\.2embed\.cc\/swish\?id=([^&"']+)/);
      if (iframeMatch) {
        rcpUrl = `https://streamsrcs.2embed.cc/swish?id=${iframeMatch[1]}`;
      } else {
        rcpUrl = `https://www.2embed.cc/rcp/${hash}`;
      }
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
    console.log(`Error in hash-decode: ${error.message}`);
  }
  
  return sources;
}

/**
 * Extract using iframe chain method
 */
async function extractIframeChain(provider) {
  const sources = [];
  
  try {
    const embedPage = await fetchPage(provider.embedUrl);
    console.log(`Page length: ${embedPage.length} bytes`);
    
    // Extract all iframes
    const iframes = [...embedPage.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)];
    console.log(`Found ${iframes.length} iframes`);
    
    for (const iframe of iframes) {
      let iframeUrl = iframe[1];
      
      if (iframeUrl.startsWith('//')) {
        iframeUrl = 'https:' + iframeUrl;
      } else if (iframeUrl.startsWith('/')) {
        const origin = new URL(provider.embedUrl).origin;
        iframeUrl = origin + iframeUrl;
      }
      
      console.log(`Checking iframe: ${iframeUrl}`);
      
      try {
        const iframePage = await fetchPage(iframeUrl, provider.embedUrl);
        
        // Look for M3U8
        const m3u8Match = iframePage.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);
        if (m3u8Match) {
          sources.push({
            url: m3u8Match[0],
            quality: 'auto'
          });
        }
        
        // Look for player sources
        const sourceMatch = iframePage.match(/file:\s*["']([^"']+)["']/);
        if (sourceMatch && sourceMatch[1].includes('.m3u8')) {
          sources.push({
            url: sourceMatch[1],
            quality: 'auto'
          });
        }
      } catch (err) {
        console.log(`  Failed to fetch iframe: ${err.message}`);
      }
    }
    
  } catch (error) {
    console.log(`Error in iframe-chain: ${error.message}`);
  }
  
  return sources;
}

/**
 * Extract using player config method
 */
async function extractPlayerConfig(provider) {
  const sources = [];
  
  try {
    const embedPage = await fetchPage(provider.embedUrl);
    console.log(`Page length: ${embedPage.length} bytes`);
    
    // Look for Playerjs config
    const playerMatch = embedPage.match(/file:\s*["']([^"']+)["']/);
    if (playerMatch) {
      let url = playerMatch[1];
      console.log(`Found player file: ${url}`);
      
      // Decode if base64
      if (url.startsWith('data:')) {
        const base64Match = url.match(/base64,([^"']+)/);
        if (base64Match) {
          url = Buffer.from(base64Match[1], 'base64').toString('utf-8');
          console.log(`Decoded from base64: ${url}`);
        }
      }
      
      // Resolve relative URLs
      if (url.startsWith('//')) {
        url = 'https:' + url;
      } else if (url.startsWith('/')) {
        const origin = new URL(provider.embedUrl).origin;
        url = origin + url;
      }
      
      if (url.includes('.m3u8')) {
        sources.push({
          url: url,
          quality: 'auto'
        });
      }
    }
    
    // Look for direct M3U8
    const m3u8Match = embedPage.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);
    if (m3u8Match) {
      console.log(`Found direct M3U8: ${m3u8Match[0]}`);
      sources.push({
        url: m3u8Match[0],
        quality: 'auto'
      });
    }
    
  } catch (error) {
    console.log(`Error in player-config: ${error.message}`);
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
