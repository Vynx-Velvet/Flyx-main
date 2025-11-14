/**
 * FOLLOW SUPEREMBED RCP CHAIN
 * 
 * We found an RCP URL in the page - let's follow it!
 */

const https = require('https');
const zlib = require('zlib');
const fs = require('fs');
const { URL } = require('url');

// The RCP URL we found
const rcpUrl = 'https://cloudnestra.com/rcp/NDUwM2U0YzJlZjdlNWZjMzk5YTg5NWEwZTk4NDdhYTA6Y2tKd1NHWjNaSGxFTUZnemEwaGFPVVZ2U1ZaRkswOW5lbEEyY0d4WGJGQjBkUzlhVG1Fclp6QnBXV2';

console.log('🔗 FOLLOWING SUPEREMBED RCP CHAIN\n');
console.log('='.repeat(80) + '\n');

async function fetchPage(url, referer = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      }
    };

    if (referer) {
      options.headers['Referer'] = referer;
      options.headers['Origin'] = new URL(referer).origin;
    }

    const req = https.request(options, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchPage(res.headers.location, referer)
          .then(resolve)
          .catch(reject);
      }

      let stream = res;
      const encoding = res.headers['content-encoding'];

      // Handle compression
      if (encoding === 'gzip') {
        stream = res.pipe(zlib.createGunzip());
      } else if (encoding === 'deflate') {
        stream = res.pipe(zlib.createInflate());
      } else if (encoding === 'br') {
        stream = res.pipe(zlib.createBrotliDecompress());
      }

      let data = '';
      stream.setEncoding('utf8');
      stream.on('data', chunk => data += chunk);
      stream.on('end', () => resolve(data));
      stream.on('error', reject);
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

(async () => {
  try {
    // Step 1: Fetch the RCP page
    console.log('Step 1: Fetching RCP page...');
    console.log(`URL: ${rcpUrl}\n`);
    
    const rcpHtml = await fetchPage(rcpUrl);
    console.log(`✅ Fetched (${rcpHtml.length} bytes)\n`);
    
    fs.writeFileSync('deobfuscation/superembed-rcp-chain.html', rcpHtml);
    
    // Step 2: Extract ProRCP or SrcRCP URL
    console.log('Step 2: Extracting ProRCP/SrcRCP URL...\n');
    
    const patterns = [
      /srcrcp\/([A-Za-z0-9+/=]+)/,
      /prorcp\/([A-Za-z0-9+/=]+)/,
    ];
    
    let nextUrl = null;
    for (const pattern of patterns) {
      const match = rcpHtml.match(pattern);
      if (match) {
        nextUrl = `https://cloudnestra.com/${match[0]}`;
        console.log(`✅ Found: ${nextUrl}\n`);
        break;
      }
    }
    
    if (!nextUrl) {
      console.log('❌ No ProRCP/SrcRCP URL found\n');
      console.log('Page content preview:');
      console.log(rcpHtml.substring(0, 1000));
      return;
    }
    
    // Step 3: Fetch the player page
    console.log('Step 3: Fetching player page...\n');
    
    const playerHtml = await fetchPage(nextUrl, rcpUrl);
    console.log(`✅ Fetched (${playerHtml.length} bytes)\n`);
    
    fs.writeFileSync('deobfuscation/superembed-player-chain.html', playerHtml);
    
    // Step 4: Look for sources in the player page
    console.log('Step 4: Searching for sources...\n');
    
    // Look for M3U8 URLs
    const m3u8Pattern = /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi;
    const m3u8Urls = [...new Set([...playerHtml.matchAll(m3u8Pattern)].map(m => m[0]))];
    
    if (m3u8Urls.length > 0) {
      console.log(`✅ FOUND ${m3u8Urls.length} M3U8 URLs:\n`);
      m3u8Urls.forEach((url, i) => {
        console.log(`${i + 1}. ${url}`);
      });
      console.log('');
    }
    
    // Look for hidden divs
    const hiddenDivPattern = /<div[^>]+style=["'][^"']*display:\s*none[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
    const hiddenDivs = [...playerHtml.matchAll(hiddenDivPattern)];
    
    console.log(`Found ${hiddenDivs.length} hidden divs\n`);
    
    hiddenDivs.forEach((match, i) => {
      const content = match[1].trim();
      if (content.length > 100 && /^[A-Za-z0-9+/=\s]+$/.test(content)) {
        console.log(`Hidden div ${i + 1}: ${content.length} chars (looks like base64)`);
        
        // Try to decode
        try {
          const decoded = Buffer.from(content.replace(/\s/g, ''), 'base64').toString('utf-8');
          if (decoded.includes('.m3u8') || decoded.includes('http')) {
            console.log(`✅ DECODED: ${decoded}\n`);
          }
        } catch (e) {}
      }
    });
    
    // Look for sources in scripts
    console.log('\nSearching scripts for sources...\n');
    
    const scripts = [...playerHtml.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
    
    scripts.forEach((script, i) => {
      const content = script[1];
      
      if (content.length < 100000 && (content.includes('source') || content.includes('file') || content.includes('m3u8'))) {
        console.log(`Script ${i + 1} contains source keywords (${content.length} chars)`);
        
        // Look for source assignments
        const sourcePatterns = [
          /["']file["']\s*:\s*["']([^"']+)["']/gi,
          /["']source["']\s*:\s*["']([^"']+)["']/gi,
          /["']url["']\s*:\s*["']([^"']+)["']/gi,
        ];
        
        sourcePatterns.forEach(pattern => {
          const matches = [...content.matchAll(pattern)];
          matches.forEach(m => {
            const url = m[1];
            if (url.includes('http') || url.includes('.m3u8')) {
              console.log(`  ✅ Found: ${url}`);
            }
          });
        });
      }
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('CHAIN COMPLETE');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  }
})();
