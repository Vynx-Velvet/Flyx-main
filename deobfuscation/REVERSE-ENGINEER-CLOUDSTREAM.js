/**
 * REVERSE ENGINEER CLOUDSTREAM
 * 
 * Deep analysis of Cloudstream to extract M3U8 URLs
 */

const https = require('https');
const fs = require('fs');

async function reverseEngineerCloudstream() {
  console.log('🔬 REVERSE ENGINEERING CLOUDSTREAM\n');
  console.log('='.repeat(80) + '\n');
  
  // Test with The Shawshank Redemption
  const tmdbId = 'tt0111161';
  
  try {
    // Step 1: Fetch the embed page
    console.log('STEP 1: Fetching Cloudstream embed page...\n');
    
    const embedUrls = [
      `https://embed.su/embed/movie/${tmdbId}`,
      `https://vidsrc.stream/embed/movie/${tmdbId}`,
      `https://vidsrc.xyz/embed/movie/${tmdbId}`,
      `https://2embed.org/embed/movie/${tmdbId}`
    ];
    
    for (const embedUrl of embedUrls) {
      console.log(`Trying: ${embedUrl}`);
      
      try {
        const embedPage = await fetchPage(embedUrl);
        
        // Save for analysis
        const filename = `cloudstream-embed-${embedUrl.split('/')[2]}.html`;
        fs.writeFileSync(`deobfuscation/${filename}`, embedPage);
        console.log(`✅ Saved to ${filename}\n`);
        
        // Step 2: Extract all script sources
        console.log('STEP 2: Extracting script sources...\n');
        
        const scriptMatches = [...embedPage.matchAll(/<script[^>]*src=["']([^"']+)["']/gi)];
        console.log(`Found ${scriptMatches.length} external scripts:`);
        scriptMatches.forEach((match, i) => {
          console.log(`${i + 1}. ${match[1]}`);
        });
        console.log('');
        
        // Step 3: Extract inline scripts
        console.log('STEP 3: Analyzing inline scripts...\n');
        
        const inlineScripts = [...embedPage.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
        console.log(`Found ${inlineScripts.length} inline scripts\n`);
        
        // Step 4: Look for API endpoints
        console.log('STEP 4: Searching for API endpoints...\n');
        
        const apiPatterns = [
          /https?:\/\/[^"'\s]+\/api\/[^"'\s]+/gi,
          /["']\/api\/[^"'\s]+["']/gi,
          /fetch\s*\(\s*["']([^"']+)["']/gi,
          /axios\.[^(]+\(\s*["']([^"']+)["']/gi
        ];
        
        const foundApis = new Set();
        apiPatterns.forEach(pattern => {
          const matches = [...embedPage.matchAll(pattern)];
          matches.forEach(match => {
            foundApis.add(match[1] || match[0]);
          });
        });
        
        if (foundApis.size > 0) {
          console.log('Found API endpoints:');
          [...foundApis].forEach((api, i) => {
            console.log(`${i + 1}. ${api}`);
          });
          console.log('');
        }
        
        // Step 5: Look for M3U8 URLs
        console.log('STEP 5: Searching for M3U8 URLs...\n');
        
        const m3u8Pattern = /https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/gi;
        const m3u8Matches = [...embedPage.matchAll(m3u8Pattern)];
        
        if (m3u8Matches.length > 0) {
          console.log('✅ FOUND M3U8 URLs:');
          m3u8Matches.forEach((match, i) => {
            console.log(`${i + 1}. ${match[0]}`);
          });
          console.log('');
        }
        
        // Step 6: Look for iframe sources
        console.log('STEP 6: Extracting iframe sources...\n');
        
        const iframeMatches = [...embedPage.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)];
        if (iframeMatches.length > 0) {
          console.log('Found iframes:');
          for (const [index, match] of iframeMatches.entries()) {
            const iframeUrl = match[1];
            console.log(`${index + 1}. ${iframeUrl}`);
            
            // Fetch iframe content
            try {
              const iframePage = await fetchPage(iframeUrl);
              const iframeFilename = `cloudstream-iframe-${index + 1}.html`;
              fs.writeFileSync(`deobfuscation/${iframeFilename}`, iframePage);
              console.log(`   Saved to ${iframeFilename}`);
              
              // Look for M3U8 in iframe
              const iframeM3u8 = [...iframePage.matchAll(m3u8Pattern)];
              if (iframeM3u8.length > 0) {
                console.log(`   ✅ Found M3U8 in iframe:`);
                iframeM3u8.forEach(m => console.log(`      ${m[0]}`));
              }
            } catch (err) {
              console.log(`   ❌ Failed to fetch iframe: ${err.message}`);
            }
          }
          console.log('');
        }
        
        // Step 7: Look for data attributes
        console.log('STEP 7: Extracting data attributes...\n');
        
        const dataAttrs = [...embedPage.matchAll(/data-([^=\s]+)=["']([^"']+)["']/gi)];
        if (dataAttrs.length > 0) {
          console.log('Found data attributes:');
          dataAttrs.slice(0, 20).forEach((match, i) => {
            console.log(`${i + 1}. data-${match[1]}="${match[2]}"`);
          });
          console.log('');
        }
        
        // Step 8: Look for base64 encoded data
        console.log('STEP 8: Searching for base64 encoded data...\n');
        
        const base64Pattern = /["']([A-Za-z0-9+/]{40,}={0,2})["']/g;
        const base64Matches = [...embedPage.matchAll(base64Pattern)];
        
        if (base64Matches.length > 0) {
          console.log(`Found ${base64Matches.length} potential base64 strings`);
          console.log('Attempting to decode first 5...\n');
          
          base64Matches.slice(0, 5).forEach((match, i) => {
            try {
              const decoded = Buffer.from(match[1], 'base64').toString('utf-8');
              if (decoded.includes('http') || decoded.includes('.m3u8')) {
                console.log(`${i + 1}. Decoded: ${decoded}`);
              }
            } catch (e) {
              // Not valid base64
            }
          });
          console.log('');
        }
        
        console.log('='.repeat(80));
        console.log(`ANALYSIS COMPLETE FOR ${embedUrl}`);
        console.log('='.repeat(80) + '\n\n');
        
      } catch (error) {
        console.log(`❌ Error with ${embedUrl}: ${error.message}\n`);
      }
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

reverseEngineerCloudstream();
