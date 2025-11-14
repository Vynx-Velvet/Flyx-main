/**
 * SUPEREMBED PUPPETEER M3U8 EXTRACTOR
 * 
 * Uses Puppeteer to intercept network requests and extract M3U8 URLs
 * This is the WORKING solution for Superembed
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

class SuperembedPuppeteerExtractor {
  constructor() {
    this.vidsrcBaseUrl = 'https://vidsrc.xyz/embed';
  }

  async extract(tmdbId, type = 'movie', season = null, episode = null) {
    console.log('\n🎬 SUPEREMBED PUPPETEER EXTRACTION');
    console.log('='.repeat(80));
    console.log(`TMDB ID: ${tmdbId}`);
    console.log(`Type: ${type}`);
    if (type === 'tv') {
      console.log(`Season: ${season}, Episode: ${episode}`);
    }
    console.log('='.repeat(80) + '\n');

    const startTime = Date.now();
    let browser = null;

    try {
      // Launch browser
      console.log('⏳ Launching browser...');
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ]
      });

      const page = await browser.newPage();
      console.log('✅ Browser launched\n');

      // Track all requests
      const allRequests = [];
      const m3u8Urls = [];
      const apiCalls = [];
      let srcrcpUrl = null;

      await page.setRequestInterception(true);

      page.on('request', request => {
        const url = request.url();
        const resourceType = request.resourceType();

        allRequests.push({ url, type: resourceType });

        // Capture SrcRCP URL
        if (url.includes('/srcrcp/') && !srcrcpUrl) {
          srcrcpUrl = url;
          console.log(`📍 SrcRCP URL: ${url}\n`);
        }

        // Capture M3U8 URLs
        if (url.includes('.m3u8')) {
          m3u8Urls.push(url);
          console.log(`✅ M3U8 FOUND: ${url}\n`);
        }

        // Capture API calls
        if (url.includes('/api/') || url.includes('source') || url.includes('stream')) {
          apiCalls.push(url);
          console.log(`📡 API Call: ${url}\n`);
        }

        // Block images, fonts, stylesheets for speed
        if (['image', 'font', 'stylesheet'].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });

      // Capture responses
      page.on('response', async response => {
        const url = response.url();
        const contentType = response.headers()['content-type'] || '';

        // Log interesting responses
        if (url.includes('.m3u8') || url.includes('source') || url.includes('stream')) {
          console.log(`📥 Response: ${url}`);
          console.log(`   Status: ${response.status()}`);
          console.log(`   Content-Type: ${contentType}\n`);

          // Try to get response body
          try {
            const body = await response.text();
            if (body.length < 10000) {
              console.log(`   Body: ${body.substring(0, 500)}\n`);
            }
          } catch (e) {
            // Can't read body
          }
        }
      });

      // Step 1: Load VidSrc page
      const vidsrcUrl = this.constructVidSrcUrl(tmdbId, type, season, episode);
      console.log(`⏳ Step 1: Loading VidSrc page...`);
      console.log(`   ${vidsrcUrl}\n`);

      await page.goto(vidsrcUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      console.log('✅ VidSrc page loaded\n');
      await this.wait(2000);

      // Step 2: Look for Superembed server button and click it
      console.log('⏳ Step 2: Looking for Superembed server...\n');

      const superembedClicked = await page.evaluate(() => {
        // Look for server buttons
        const buttons = Array.from(document.querySelectorAll('button, a, div[data-id], [data-hash]'));
        
        for (const btn of buttons) {
          const text = btn.textContent || '';
          const dataId = btn.getAttribute('data-id') || '';
          const dataHash = btn.getAttribute('data-hash') || '';
          
          if (text.toLowerCase().includes('superembed') || dataId.toLowerCase().includes('superembed')) {
            console.log('Found Superembed button:', text, dataId);
            btn.click();
            return true;
          }
        }
        
        return false;
      });

      if (superembedClicked) {
        console.log('✅ Clicked Superembed server\n');
        await this.wait(3000);
      } else {
        console.log('⚠️  Superembed button not found, continuing anyway...\n');
      }

      // Step 3: Wait for SrcRCP to load
      if (srcrcpUrl) {
        console.log('⏳ Step 3: Loading SrcRCP player...\n');
        await page.goto(srcrcpUrl, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        console.log('✅ SrcRCP page loaded\n');
        await this.wait(3000);
      }

      // Step 4: Look for play button and click it
      console.log('⏳ Step 4: Looking for play button...\n');

      const playClicked = await page.evaluate(() => {
        const selectors = [
          '#pl_but',
          '#pl_but_background',
          '.play-button',
          '[class*="play"]',
          'button[class*="play"]',
          '.vjs-big-play-button'
        ];

        for (const selector of selectors) {
          const btn = document.querySelector(selector);
          if (btn) {
            console.log('Found play button:', selector);
            btn.click();
            return true;
          }
        }

        return false;
      });

      if (playClicked) {
        console.log('✅ Clicked play button\n');
        await this.wait(5000);
      } else {
        console.log('⚠️  Play button not found\n');
      }

      // Step 5: Extract sources from page
      console.log('⏳ Step 5: Extracting sources from page...\n');

      const pageSources = await page.evaluate(() => {
        const sources = [];

        // Look for video elements
        const videos = document.querySelectorAll('video');
        videos.forEach(v => {
          if (v.src) sources.push({ type: 'video.src', url: v.src });
          const sourceTags = v.querySelectorAll('source');
          sourceTags.forEach(s => {
            if (s.src) sources.push({ type: 'source.src', url: s.src });
          });
        });

        // Look for window variables
        if (window.sources) sources.push({ type: 'window.sources', data: window.sources });
        if (window.playerConfig) sources.push({ type: 'window.playerConfig', data: window.playerConfig });

        // Look for data attributes
        const dataElements = document.querySelectorAll('[data-src], [data-source], [data-file]');
        dataElements.forEach(el => {
          const src = el.getAttribute('data-src') || el.getAttribute('data-source') || el.getAttribute('data-file');
          if (src) sources.push({ type: 'data-attribute', url: src });
        });

        return sources;
      });

      if (pageSources.length > 0) {
        console.log(`✅ Found ${pageSources.length} sources in page:\n`);
        pageSources.forEach((s, i) => {
          console.log(`${i + 1}. [${s.type}] ${JSON.stringify(s).substring(0, 150)}`);
        });
        console.log('');
      }

      // Step 6: Save all captured data
      const result = {
        success: m3u8Urls.length > 0,
        m3u8Urls,
        srcrcpUrl,
        apiCalls,
        pageSources,
        allRequests: allRequests.filter(r => 
          r.url.includes('m3u8') || 
          r.url.includes('source') || 
          r.url.includes('stream') ||
          r.url.includes('api')
        ),
        duration: Date.now() - startTime
      };

      // Save to file
      fs.writeFileSync(
        'deobfuscation/superembed-extraction-result.json',
        JSON.stringify(result, null, 2)
      );

      const duration = Date.now() - startTime;

      console.log('='.repeat(80));
      if (m3u8Urls.length > 0) {
        console.log(`✅ EXTRACTION COMPLETE in ${duration}ms`);
        console.log('='.repeat(80));
        console.log(`\nFound ${m3u8Urls.length} M3U8 URLs:\n`);
        m3u8Urls.forEach((url, i) => {
          console.log(`${i + 1}. ${url}`);
        });
        console.log('');
      } else {
        console.log(`⚠️  NO M3U8 FOUND in ${duration}ms`);
        console.log('='.repeat(80));
        console.log(`\nCaptured ${allRequests.length} requests`);
        console.log(`API calls: ${apiCalls.length}`);
        console.log(`Page sources: ${pageSources.length}\n`);
      }

      return result;

    } catch (error) {
      console.error(`\n❌ EXTRACTION FAILED: ${error.message}`);
      console.error(error.stack);
      
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };

    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  constructVidSrcUrl(tmdbId, type, season, episode) {
    if (type === 'movie') {
      return `${this.vidsrcBaseUrl}/movie/${tmdbId}`;
    } else {
      return `${this.vidsrcBaseUrl}/tv/${tmdbId}/${season}/${episode}`;
    }
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Test execution
if (require.main === module) {
  const extractor = new SuperembedPuppeteerExtractor();
  
  // Test with The Shawshank Redemption
  extractor.extract('tt0111161', 'movie')
    .then(result => {
      console.log('\n📊 FINAL RESULT:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.success) {
        console.log('\n✅ SUCCESS! M3U8 URLs extracted.');
        console.log('\nTest the URLs:');
        result.m3u8Urls.forEach((url, i) => {
          console.log(`\ncurl -I "${url}"`);
        });
      } else {
        console.log('\n⚠️  Check superembed-extraction-result.json for details');
      }
    })
    .catch(error => {
      console.error('\n❌ ERROR:', error);
    })
    .finally(() => {
      process.exit(0);
    });
}

module.exports = SuperembedPuppeteerExtractor;
