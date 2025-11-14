/**
 * FINAL WORKING ALL SOURCES EXTRACTOR
 * 
 * Based on proven working VidSrc extraction method
 * Returns ALL available sources from ALL working providers
 */

const https = require('https');
const zlib = require('zlib');

const TMDB_ID = 'tt0111161';

async function extractAllSources() {
  console.log('🎬 FINAL WORKING ALL SOURCES EXTRACTOR\n');
  console.log('='.repeat(80) + '\n');
  
  const allSources = [];
  
  // Working providers based on reverse engineering
  const providers = [
    {
      name: 'VidSrc.xyz (Primary)',
      embedUrl: `https://vidsrc.xyz/embed/movie/${TMDB_ID}`,
      rcpBase: 'https://vidsrc.net/rcp'
    },
    {
      name: 'VidSrc.to',
      embedUrl: `https://vidsrc.to/embed/movie/${TMDB_ID}`,
      rcpBase: 'https://vidsrc.net/rcp'
    },
    {
      name: 'VidSrc.me',
      embedUrl: `https://vidsrc.me/embed/movie/${TMDB_ID}`,
      rcpBase: 'https://vidsrc.net/rcp'
    },
    {
      name: 'VidSrc.in',
      embedUrl: `https://vidsrc.in/embed/movie/${TMDB_ID}`,
      rcpBase: 'https://vidsrc.net/rcp'
    }
  ];
  
  for (const provider of providers) {
    console.log(`\nExtracting from: ${provider.name}`);
    console.log('-'.repeat(80));
    
    try {
      const source = await extractVidSrcMethod(provider);
      
      if (source) {
        console.log(`✅ SUCCESS!`);
        console.log(`   URL: ${source.url}`);
        console.log(`   Quality: ${source.quality}`);
        allSources.push({...source, provider: provider.name});
      } else {
        console.log(`❌ No source found`);
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('FINAL RESULTS');
  console.log('='.repeat(80) + '\n');
  
  console.log(`Total sources found: ${allSources.length}\n`);
  
  if (allSources.length > 0) {
    console.log('ALL WORKING SOURCES:\n');
    allSources.forEach((src, i) => {
      console.log(`${i + 1}. [${src.provider}]`);
      console.log(`   ${src.url}\n`);
    });
    
    // Save to file
    const output = {
      tmdbId: TMDB_ID,
      timestamp: new Date().toISOString(),
      totalSources: allSources.length,
      sources: allSources
    };
    
    require('fs').writeFileSync(
      'deobfuscation/ALL-SOURCES-OUTPUT.json',
      JSON.stringify(output, null, 2)
    );
    
    console.log('✅ Saved all sources to ALL-SOURCES-OUTPUT.json');
  } else {
    console.log('❌ NO SOURCES FOUND');
  }
  
  return allSources;
}

/**
 * Extract using proven VidSrc method
 */
async function extractVidSrcMethod(provider) {
  try {
    // Step 1: Fetch embed page
    console.log(`  Fetching embed page...`);
    const embedPage = await fetchPage(provider.embedUrl);
    
    if (!embedPage || embedPage.length < 100) {
      throw new Error('Empty or invalid page');
    }
    
    // Step 2: Extract hash
    const hashMatch = embedPage.match(/data-hash=["']([^"']+)["']/);
    if (!hashMatch) {
      throw new Error('No hash found');
    }
    
    const hash = hashMatch[1];
    console.log(`  Hash: ${hash}`);
    
    // Step 3: Extract divId (decryption key)
    const divIdMatch = embedPage.match(/id=["']([a-zA-Z0-9]{10,})["']/);
    const divId = divIdMatch ? divIdMatch[1] : 'PRO';
    console.log(`  DivId: ${divId}`);
    
    // Step 4: Fetch RCP data
    const rcpUrl = `${provider.rcpBase}/${hash}`;
    console.log(`  Fetching RCP: ${rcpUrl}`);
    const rcpData = await fetchPage(rcpUrl, provider.embedUrl);
    
    if (!rcpData) {
      throw new Error('No RCP data');
    }
    
    // Step 5: Decode
    console.log(`  Decoding...`);
    const decoded = decodeData(rcpData, divId);
    
    if (!decoded) {
      throw new Error('Decode failed');
    }
    
    // Step 6: Resolve placeholders
    const resolved = decoded
      .replace(/\{v1\}/g, 'shadowlandschronicles.com')
      .replace(/\{v2\}/g, 'shadowlandschronicles.net')
      .replace(/\{v3\}/g, 'shadowlandschronicles.io')
      .replace(/\{v4\}/g, 'shadowlandschronicles.org');
    
    // Step 7: Extract M3U8
    const m3u8Match = resolved.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);
    
    if (m3u8Match) {
      return {
        url: m3u8Match[0],
        quality: 'auto',
        method: 'hash-decode'
      };
    }
    
    return null;
    
  } catch (error) {
    throw error;
  }
}

/**
 * Decode using XOR cipher
 */
function decodeData(encodedData, key) {
  try {
    let data = encodedData.startsWith('g') ? encodedData.substring(1) : encodedData;
    const decoded = Buffer.from(data, 'base64');
    const decompressed = zlib.gunzipSync(decoded);
    const keyBytes = Buffer.from(key, 'utf-8');
    const decrypted = Buffer.alloc(decompressed.length);
    
    for (let i = 0; i < decompressed.length; i++) {
      decrypted[i] = decompressed[i] ^ keyBytes[i % keyBytes.length];
    }
    
    return decrypted.toString('utf-8');
  } catch (error) {
    return null;
  }
}

/**
 * Fetch page
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

// Run
extractAllSources().then(sources => {
  console.log(`\n✅ Complete! Found ${sources.length} working sources.`);
  process.exit(0);
}).catch(error => {
  console.error(`\n❌ Fatal: ${error.message}`);
  process.exit(1);
});
