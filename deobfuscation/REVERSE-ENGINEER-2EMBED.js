/**
 * REVERSE ENGINEER 2EMBED
 * 
 * Deep analysis of 2Embed to extract M3U8 URLs
 */

const https = require('https');
const fs = require('fs');

async function reverseEngineer2Embed() {
  console.log('🔬 REVERSE ENGINEERING 2EMBED\n');
  console.log('='.repeat(80) + '\n');
  
  const tmdbId = 'tt0111161';
  
  try {
    const embedUrls = [
      `https://www.2embed.cc/embed/${tmdbId}`,
      `https://www.2embed.to/embed/tmdb/movie?id=${tmdbId}`,
      `https://2embed.org/embed/${tmdbId}`
    ];
    
    for (const embedUrl of embedUrls) {
      console.log(`\nAnalyzing: ${embedUrl}\n`);
      console.log('='.repeat(80) + '\n');
      
      try {
        const embedPage = await fetchPage(embedUrl);
        
        const filename = `2embed-${embedUrl.split('/')[2]}.html`;
        fs.writeFileSync(`deobfuscation/${filename}`, embedPage);
        console.log(`✅ Saved embed page to ${filename}\n`);
        
        // Step 1: Extract all iframes
        console.log('STEP 1: Extracting iframes...\n');
        
        const iframes = [...embedPage.matchAll(/<iframe[^>]*src=["']([^"']+)["']/gi)];
        console.log(`Found ${iframes.length} iframes\n`);
        
        for (const [index, iframe] of iframes.entries()) {
          let iframeUrl = iframe[1];
          
          // Resolve relative URLs
          if (iframeUrl.startsWith('//')) {
            iframeUrl = 'https:' + iframeUrl;
          } else if (iframeUrl.startsWith('/')) {
            const origin = new URL(embedUrl).origin;
            iframeUrl = origin + iframeUrl;
          }
          
          console.log(`Iframe ${index + 1}: ${iframeUrl}`);
          
          try {
            const iframePage = await fetchPage(iframeUrl, embedUrl);
            const iframeFilename = `2embed-iframe-${index + 1}.html`;
            fs.writeFileSync(`deobfuscation/${iframeFilename}`, iframePage);
            console.log(`  Saved to ${iframeFilename}`);
            
            // Step 2: Analyze iframe content
            console.log(`  Analyzing iframe content...\n`);
            
            // Look for M3U8 URLs
            const m3u8Pattern = /https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/gi;
            const m3u8Matches = [...iframePage.matchAll(m3u8Pattern)];
            
            if (m3u8Matches.length > 0) {
              console.log(`  ✅ FOUND M3U8 URLs:`);
              m3u8Matches.forEach(m => console.log(`     ${m[0]}`));
              console.log('');
            }
            
            // Look for player sources
            const sourcePatterns = [
              /file:\s*["']([^"']+)["']/gi,
              /source:\s*["']([^"']+)["']/gi,
              /src:\s*["']([^"']+)["']/gi,
              /"file":\s*["']([^"']+)["']/gi,
              /sources:\s*\[\s*["']([^"']+)["']/gi,
              /sources:\s*\[\s*{\s*file:\s*["']([^"']+)["']/gi
            ];
            
            console.log(`  Searching for player sources...`);
            sourcePatterns.forEach((pattern, i) => {
              const matches = [...iframePage.matchAll(pattern)];
              if (matches.length > 0) {
                console.log(`    Pattern ${i + 1}: Found ${matches.length} matches`);
                matches.forEach(m => console.log(`      ${m[1]}`));
              }
            });
            console.log('');
            
            // Look for base64 encoded data
            console.log(`  Searching for encoded data...`);
            const atobMatches = [...iframePage.matchAll(/atob\s*\(\s*["']([^"']+)["']\s*\)/gi)];
            
            if (atobMatches.length > 0) {
              console.log(`    Found ${atobMatches.length} atob calls:`);
              atobMatches.forEach((match, i) => {
                try {
                  const decoded = Buffer.from(match[1], 'base64').toString('utf-8');
                  console.log(`      ${i + 1}. Decoded: ${decoded.substring(0, 200)}...`);
                  
                  // Check if decoded contains M3U8
                  const decodedM3u8 = decoded.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);
                  if (decodedM3u8) {
                    console.log(`         ✅ Contains M3U8: ${decodedM3u8[0]}`);
                  }
                } catch (e) {
                  console.log(`      ${i + 1}. Failed to decode`);
                }
              });
              console.log('');
            }
            
            // Look for API calls
            console.log(`  Searching for API calls...`);
            const apiPatterns = [
              /fetch\s*\(\s*["']([^"']+)["']/gi,
              /axios\.[^(]+\(\s*["']([^"']+)["']/gi,
              /\$\.ajax\s*\(\s*{[^}]*url:\s*["']([^"']+)["']/gi
            ];
            
            apiPatterns.forEach((pattern, i) => {
              const matches = [...iframePage.matchAll(pattern)];
              if (matches.length > 0) {
                console.log(`    API Pattern ${i + 1}:`);
                matches.forEach(m => console.log(`      ${m[1]}`));
              }
            });
            console.log('');
            
            // Look for nested iframes
            const nestedIframes = [...iframePage.matchAll(/<iframe[^>]*src=["']([^"']+)["']/gi)];
            if (nestedIframes.length > 0) {
              console.log(`  Found ${nestedIframes.length} nested iframes:`);
              nestedIframes.forEach((ni, i) => {
                console.log(`    ${i + 1}. ${ni[1]}`);
              });
              console.log('');
            }
            
            // Extract all scripts
            const scripts = [...iframePage.matchAll(/<script[^>]*src=["']([^"']+)["']/gi)];
            if (scripts.length > 0) {
              console.log(`  Found ${scripts.length} external scripts:`);
              scripts.forEach((s, i) => {
                console.log(`    ${i + 1}. ${s[1]}`);
              });
              console.log('');
            }
            
          } catch (err) {
            console.log(`  ❌ Failed to fetch iframe: ${err.message}\n`);
          }
        }
        
        // Step 3: Look for direct M3U8 in main page
        console.log('STEP 2: Searching main page for M3U8...\n');
        
        const mainM3u8 = [...embedPage.matchAll(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/gi)];
        if (mainM3u8.length > 0) {
          console.log('✅ Found M3U8 in main page:');
          mainM3u8.forEach(m => console.log(`  ${m[0]}`));
          console.log('');
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

function fetchPage(url, referer) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': referer || 'https://www.2embed.cc/'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

reverseEngineer2Embed();
