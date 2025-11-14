/**
 * REVERSE ENGINEER SUPEREMBED
 * 
 * Deep analysis of Superembed to extract M3U8 URLs
 */

const https = require('https');
const fs = require('fs');

async function reverseEngineerSuperembed() {
  console.log('🔬 REVERSE ENGINEERING SUPEREMBED\n');
  console.log('='.repeat(80) + '\n');
  
  const tmdbId = 'tt0111161';
  
  try {
    const embedUrls = [
      `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`,
      `https://www.2embed.to/embed/tmdb/movie?id=${tmdbId}`,
      `https://embed.smashystream.com/playere.php?tmdb=${tmdbId}`
    ];
    
    for (const embedUrl of embedUrls) {
      console.log(`\nAnalyzing: ${embedUrl}\n`);
      console.log('='.repeat(80) + '\n');
      
      try {
        const embedPage = await fetchPage(embedUrl);
        
        const filename = `superembed-${embedUrl.split('/')[2].split('?')[0]}.html`;
        fs.writeFileSync(`deobfuscation/${filename}`, embedPage);
        console.log(`✅ Saved embed page to ${filename}\n`);
        
        // Extract player configuration
        console.log('STEP 1: Extracting player configuration...\n');
        
        const playerConfigs = [
          /var\s+player\s*=\s*new\s+Playerjs\s*\(\s*({[\s\S]*?})\s*\)/gi,
          /Playerjs\s*\(\s*({[\s\S]*?})\s*\)/gi,
          /sources:\s*\[([^\]]+)\]/gi,
          /file:\s*["']([^"']+)["']/gi
        ];
        
        playerConfigs.forEach((pattern, i) => {
          const matches = [...embedPage.matchAll(pattern)];
          if (matches.length > 0) {
            console.log(`Pattern ${i + 1} found ${matches.length} matches:`);
            matches.forEach((match, j) => {
              console.log(`  ${j + 1}. ${match[1] || match[0]}`);
            });
            console.log('');
          }
        });
        
        // Extract all URLs
        console.log('STEP 2: Extracting all URLs...\n');
        
        const urlPattern = /https?:\/\/[^"'\s<>]+/gi;
        const urls = [...new Set([...embedPage.matchAll(urlPattern)].map(m => m[0]))];
        
        console.log(`Found ${urls.length} unique URLs:`);
        urls.slice(0, 20).forEach((url, i) => {
          console.log(`${i + 1}. ${url}`);
        });
        console.log('');
        
        // Look for M3U8
        console.log('STEP 3: Searching for M3U8 URLs...\n');
        
        const m3u8Urls = urls.filter(url => url.includes('.m3u8'));
        if (m3u8Urls.length > 0) {
          console.log('✅ FOUND M3U8 URLs:');
          m3u8Urls.forEach((url, i) => {
            console.log(`${i + 1}. ${url}`);
          });
          console.log('');
        } else {
          console.log('No direct M3U8 URLs found\n');
        }
        
        // Extract and analyze scripts
        console.log('STEP 4: Analyzing JavaScript...\n');
        
        const scripts = [...embedPage.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
        console.log(`Found ${scripts.length} script blocks\n`);
        
        scripts.forEach((script, i) => {
          const content = script[1];
          
          // Look for fetch/ajax calls
          const fetchCalls = [...content.matchAll(/fetch\s*\(\s*["']([^"']+)["']/gi)];
          if (fetchCalls.length > 0) {
            console.log(`Script ${i + 1} - Fetch calls:`);
            fetchCalls.forEach(call => console.log(`  ${call[1]}`));
          }
          
          // Look for atob (base64 decode)
          const atobCalls = [...content.matchAll(/atob\s*\(\s*["']([^"']+)["']/gi)];
          if (atobCalls.length > 0) {
            console.log(`Script ${i + 1} - Base64 encoded:`);
            atobCalls.forEach(call => {
              try {
                const decoded = Buffer.from(call[1], 'base64').toString('utf-8');
                console.log(`  Decoded: ${decoded}`);
              } catch (e) {}
            });
          }
        });
        console.log('');
        
        // Extract iframes
        console.log('STEP 5: Extracting and analyzing iframes...\n');
        
        const iframes = [...embedPage.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)];
        if (iframes.length > 0) {
          console.log(`Found ${iframes.length} iframes:\n`);
          
          for (const [index, iframe] of iframes.entries()) {
            const iframeUrl = iframe[1].startsWith('//') ? 'https:' + iframe[1] : iframe[1];
            console.log(`${index + 1}. ${iframeUrl}`);
            
            try {
              const iframePage = await fetchPage(iframeUrl);
              const iframeFilename = `superembed-iframe-${index + 1}.html`;
              fs.writeFileSync(`deobfuscation/${iframeFilename}`, iframePage);
              console.log(`   Saved to ${iframeFilename}`);
              
              // Search for M3U8 in iframe
              const iframeM3u8 = [...iframePage.matchAll(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/gi)];
              if (iframeM3u8.length > 0) {
                console.log(`   ✅ Found M3U8:`);
                iframeM3u8.forEach(m => console.log(`      ${m[0]}`));
              }
              
              // Look for player config in iframe
              const playerMatch = iframePage.match(/file:\s*["']([^"']+)["']/);
              if (playerMatch) {
                console.log(`   ✅ Found player file: ${playerMatch[1]}`);
              }
              
            } catch (err) {
              console.log(`   ❌ Failed: ${err.message}`);
            }
            console.log('');
          }
        }
        
        console.log('='.repeat(80));
        console.log('ANALYSIS COMPLETE');
        console.log('='.repeat(80) + '\n');
        
      } catch (error) {
        console.log(`❌ Error: ${error.message}\n`);
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
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://multiembed.mov/'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

reverseEngineerSuperembed();
