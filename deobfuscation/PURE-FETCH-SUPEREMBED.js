/**
 * PURE FETCH SUPEREMBED EXTRACTOR
 * 
 * Complete pure-fetch solution for Superembed provider
 * Following the successful cloudstream methodology
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');

class SuperembedPureFetchExtractor {
  constructor() {
    this.vidsrcBaseUrl = 'https://vidsrc.cc/v2/embed';
    this.rcpBaseUrl = 'https://cloudnestra.com';
  }

  /**
   * Main extraction method
   */
  async extract(tmdbId, type = 'movie', season = null, episode = null) {
    console.log('🎬 SUPEREMBED PURE FETCH EXTRACTION');
    console.log('='.repeat(80));
    console.log(`TMDB ID: ${tmdbId}`);
    console.log(`Type: ${type}`);
    if (type === 'tv') {
      console.log(`Season: ${season}, Episode: ${episode}`);
    }
    console.log('='.repeat(80) + '\n');

    const startTime = Date.now();

    try {
      // Step 1: Construct VidSrc URL
      const vidsrcUrl = this.constructVidSrcUrl(tmdbId, type, season, episode);
      console.log('✅ Step 1: VidSrc URL constructed');
      console.log(`   ${vidsrcUrl}\n`);

      // Step 2: Fetch VidSrc page
      console.log('⏳ Step 2: Fetching VidSrc page...');
      const vidsrcHtml = await this.fetchPage(vidsrcUrl, {
        'Referer': 'https://vidsrc.cc/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      });
      console.log(`✅ Step 2: VidSrc page fetched (${vidsrcHtml.length} bytes)\n`);

      // Save for analysis
      fs.writeFileSync('deobfuscation/superembed-vidsrc-page.html', vidsrcHtml);

      // Step 3: Extract Superembed hash
      console.log('⏳ Step 3: Extracting Superembed hash...');
      const hash = this.extractHash(vidsrcHtml, 'superembed');
      if (!hash) {
        throw new Error('Superembed hash not found in VidSrc page');
      }
      console.log(`✅ Step 3: Hash extracted`);
      console.log(`   ${hash.substring(0, 50)}...\n`);

      // Step 4: Fetch RCP page
      console.log('⏳ Step 4: Fetching CloudNestra RCP page...');
      const rcpUrl = `${this.rcpBaseUrl}/rcp/${hash}`;
      const rcpHtml = await this.fetchPage(rcpUrl, {
        'Referer': vidsrcUrl,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      });
      console.log(`✅ Step 4: RCP page fetched (${rcpHtml.length} bytes)\n`);

      // Save for analysis
      fs.writeFileSync('deobfuscation/superembed-rcp-page.html', rcpHtml);

      // Step 5: Extract ProRCP URL
      console.log('⏳ Step 5: Extracting ProRCP URL...');
      const proRcpUrl = this.extractProRcpUrl(rcpHtml);
      if (!proRcpUrl) {
        throw new Error('ProRCP URL not found in RCP page');
      }
      console.log(`✅ Step 5: ProRCP URL extracted`);
      console.log(`   ${proRcpUrl}\n`);

      // Step 6: Fetch ProRCP player page
      console.log('⏳ Step 6: Fetching ProRCP player page...');
      const playerHtml = await this.fetchPage(proRcpUrl, {
        'Referer': rcpUrl,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      });
      console.log(`✅ Step 6: Player page fetched (${playerHtml.length} bytes)\n`);

      // Save for analysis
      fs.writeFileSync('deobfuscation/superembed-player-page.html', playerHtml);

      // Step 7: Extract hidden div data
      console.log('⏳ Step 7: Extracting hidden div data...');
      const hiddenDiv = this.extractHiddenDiv(playerHtml);
      if (!hiddenDiv) {
        throw new Error('Hidden div not found in player page');
      }
      console.log(`✅ Step 7: Hidden div extracted`);
      console.log(`   Div ID: ${hiddenDiv.divId}`);
      console.log(`   Encoded length: ${hiddenDiv.encoded.length} chars\n`);

      // Step 8: Extract all JavaScript sources
      console.log('⏳ Step 8: Extracting JavaScript sources...');
      const scripts = this.extractScripts(playerHtml);
      console.log(`✅ Step 8: Found ${scripts.inline.length} inline and ${scripts.external.length} external scripts\n`);

      // Save scripts
      scripts.inline.forEach((script, i) => {
        fs.writeFileSync(`deobfuscation/superembed-inline-${i}.js`, script);
      });

      // Step 9: Fetch external scripts
      console.log('⏳ Step 9: Fetching external scripts...');
      for (let i = 0; i < scripts.external.length; i++) {
        const scriptUrl = scripts.external[i];
        try {
          const scriptContent = await this.fetchPage(scriptUrl, {
            'Referer': proRcpUrl,
            'Accept': '*/*'
          });
          fs.writeFileSync(`deobfuscation/superembed-external-${i}.js`, scriptContent);
          console.log(`   ✅ Fetched: ${scriptUrl.split('/').pop()}`);
        } catch (err) {
          console.log(`   ❌ Failed: ${scriptUrl} - ${err.message}`);
        }
      }
      console.log('');

      // Step 10: Analyze decryption
      console.log('⏳ Step 10: Analyzing decryption logic...');
      const analysis = this.analyzeDecryption(scripts, hiddenDiv);
      console.log(`✅ Step 10: Analysis complete\n`);

      // Step 11: Try all decoding methods
      console.log('⏳ Step 11: Attempting decryption...');
      const decodedUrl = await this.tryAllDecoders(hiddenDiv.encoded, hiddenDiv.divId);
      
      if (decodedUrl) {
        console.log(`✅ Step 11: Successfully decoded!\n`);
        console.log(`   Method: ${decodedUrl.method}`);
        console.log(`   URL: ${decodedUrl.url}\n`);

        // Step 12: Resolve placeholders
        console.log('⏳ Step 12: Resolving CDN placeholders...');
        const resolvedUrls = this.resolvePlaceholders(decodedUrl.url);
        console.log(`✅ Step 12: Resolved to ${resolvedUrls.length} CDN variants\n`);

        resolvedUrls.forEach((url, i) => {
          console.log(`   ${i + 1}. ${url}`);
        });
        console.log('');

        const duration = Date.now() - startTime;
        console.log('='.repeat(80));
        console.log(`✅ EXTRACTION COMPLETE in ${duration}ms`);
        console.log('='.repeat(80));

        return {
          success: true,
          m3u8Url: resolvedUrls[0],
          m3u8Urls: resolvedUrls,
          method: decodedUrl.method,
          duration,
          steps: {
            vidsrcUrl,
            hash,
            rcpUrl,
            proRcpUrl,
            hiddenDiv,
            scripts: {
              inline: scripts.inline.length,
              external: scripts.external.length
            }
          }
        };
      } else {
        console.log(`❌ Step 11: Decryption failed\n`);
        
        // Save analysis report
        const report = {
          tmdbId,
          type,
          season,
          episode,
          vidsrcUrl,
          hash,
          rcpUrl,
          proRcpUrl,
          hiddenDiv,
          scripts: {
            inline: scripts.inline.length,
            external: scripts.external.length,
            externalUrls: scripts.external
          },
          analysis,
          timestamp: new Date().toISOString()
        };

        fs.writeFileSync(
          'deobfuscation/superembed-analysis-report.json',
          JSON.stringify(report, null, 2)
        );

        console.log('📊 Analysis report saved to superembed-analysis-report.json\n');
        console.log('='.repeat(80));
        console.log('⚠️  EXTRACTION INCOMPLETE - Decryption needed');
        console.log('='.repeat(80));

        return {
          success: false,
          error: 'Decryption algorithm not yet implemented',
          data: report,
          duration: Date.now() - startTime
        };
      }

    } catch (error) {
      console.error('\n❌ EXTRACTION FAILED:', error.message);
      console.error(error.stack);
      
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Construct VidSrc embed URL
   */
  constructVidSrcUrl(tmdbId, type, season, episode) {
    if (type === 'movie') {
      return `${this.vidsrcBaseUrl}/movie/${tmdbId}`;
    } else {
      return `${this.vidsrcBaseUrl}/tv/${tmdbId}/${season}/${episode}`;
    }
  }

  /**
   * Extract hash from VidSrc HTML
   */
  extractHash(html, provider) {
    // Pattern: data-hash="..." for specific provider
    const pattern = new RegExp(`data-id="${provider}"[^>]*data-hash="([^"]+)"`, 'i');
    const match = html.match(pattern);
    
    if (match) {
      return match[1];
    }

    // Alternative: look for any hash with provider name nearby
    const altPattern = new RegExp(`${provider}[^"]*"[^"]*"([A-Za-z0-9+/=]{40,})"`, 'i');
    const altMatch = html.match(altPattern);
    
    return altMatch ? altMatch[1] : null;
  }

  /**
   * Extract ProRCP URL from RCP HTML
   */
  extractProRcpUrl(html) {
    // Look for iframe with prorcp
    const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']*prorcp[^"']*)["']/i);
    if (iframeMatch) {
      let url = iframeMatch[1];
      if (url.startsWith('//')) {
        url = 'https:' + url;
      } else if (url.startsWith('/')) {
        url = this.rcpBaseUrl + url;
      }
      return url;
    }

    // Alternative: look for any prorcp URL
    const urlMatch = html.match(/https?:\/\/[^"'\s]*prorcp[^"'\s]*/i);
    return urlMatch ? urlMatch[0] : null;
  }

  /**
   * Extract hidden div with encoded data
   */
  extractHiddenDiv(html) {
    // Pattern: <div id="..." style="display:none">ENCODED_DATA</div>
    const divPattern = /<div[^>]+id=["']([^"']+)["'][^>]*style=["'][^"']*display:\s*none[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
    const matches = [...html.matchAll(divPattern)];

    for (const match of matches) {
      const divId = match[1];
      const content = match[2].trim();
      
      // Look for base64-like content (long alphanumeric strings)
      if (content.length > 100 && /^[A-Za-z0-9+/=]+$/.test(content)) {
        return {
          divId,
          encoded: content
        };
      }
    }

    // Alternative: look for any hidden div with long content
    const altPattern = /<div[^>]+style=["'][^"']*display:\s*none[^"']*["'][^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/div>/gi;
    const altMatches = [...html.matchAll(altPattern)];

    for (const match of altMatches) {
      const divId = match[1];
      const content = match[2].trim();
      
      if (content.length > 100 && /^[A-Za-z0-9+/=]+$/.test(content)) {
        return {
          divId,
          encoded: content
        };
      }
    }

    return null;
  }

  /**
   * Extract all scripts from HTML
   */
  extractScripts(html) {
    const inline = [];
    const external = [];

    // Extract inline scripts
    const inlinePattern = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi;
    const inlineMatches = [...html.matchAll(inlinePattern)];
    inlineMatches.forEach(match => {
      const content = match[1].trim();
      if (content.length > 0) {
        inline.push(content);
      }
    });

    // Extract external scripts
    const externalPattern = /<script[^>]+src=["']([^"']+)["']/gi;
    const externalMatches = [...html.matchAll(externalPattern)];
    externalMatches.forEach(match => {
      let url = match[1];
      if (url.startsWith('//')) {
        url = 'https:' + url;
      } else if (url.startsWith('/')) {
        url = this.rcpBaseUrl + url;
      }
      external.push(url);
    });

    return { inline, external };
  }

  /**
   * Analyze decryption logic in scripts
   */
  analyzeDecryption(scripts, hiddenDiv) {
    const analysis = {
      playerJsFound: false,
      fileVariableFound: false,
      fileVariable: null,
      decryptionPatterns: [],
      xorOperations: 0,
      charCodeOperations: 0,
      atobCalls: 0,
      cryptoUsage: false
    };

    // Analyze inline scripts
    scripts.inline.forEach((script, i) => {
      // Look for Playerjs initialization
      if (script.includes('Playerjs') || script.includes('new Player')) {
        analysis.playerJsFound = true;
      }

      // Look for file variable assignment
      const fileVarMatch = script.match(/var\s+([a-zA-Z0-9_]+)\s*=\s*["']([^"']+)["']/);
      if (fileVarMatch && fileVarMatch[2] === hiddenDiv.encoded.substring(0, 20)) {
        analysis.fileVariableFound = true;
        analysis.fileVariable = fileVarMatch[1];
      }

      // Count operations
      analysis.xorOperations += (script.match(/\^/g) || []).length;
      analysis.charCodeOperations += (script.match(/charCodeAt|fromCharCode/g) || []).length;
      analysis.atobCalls += (script.match(/atob\(/g) || []).length;
      
      if (script.includes('CryptoJS') || script.includes('crypto')) {
        analysis.cryptoUsage = true;
      }
    });

    return analysis;
  }

  /**
   * Try all known decoding methods
   */
  async tryAllDecoders(encoded, divId) {
    console.log('   Trying decoder methods...\n');

    // Method 1: Simple base64 decode
    try {
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
      if (decoded.includes('.m3u8') || decoded.includes('http')) {
        console.log('   ✅ Method 1: Simple base64 decode');
        return { url: decoded, method: 'base64' };
      }
    } catch (e) {}

    // Method 2: Base64 + URL decode
    try {
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
      const urlDecoded = decodeURIComponent(decoded);
      if (urlDecoded.includes('.m3u8') || urlDecoded.includes('http')) {
        console.log('   ✅ Method 2: Base64 + URL decode');
        return { url: urlDecoded, method: 'base64-url' };
      }
    } catch (e) {}

    // Method 3: XOR with divId
    try {
      const decoded = this.xorDecode(encoded, divId);
      if (decoded.includes('.m3u8') || decoded.includes('http')) {
        console.log('   ✅ Method 3: XOR with divId');
        return { url: decoded, method: 'xor-divid' };
      }
    } catch (e) {}

    // Method 4: Hex decode
    try {
      if (/^[0-9a-fA-F]+$/.test(encoded)) {
        const decoded = Buffer.from(encoded, 'hex').toString('utf-8');
        if (decoded.includes('.m3u8') || decoded.includes('http')) {
          console.log('   ✅ Method 4: Hex decode');
          return { url: decoded, method: 'hex' };
        }
      }
    } catch (e) {}

    // Method 5: Reverse + base64
    try {
      const reversed = encoded.split('').reverse().join('');
      const decoded = Buffer.from(reversed, 'base64').toString('utf-8');
      if (decoded.includes('.m3u8') || decoded.includes('http')) {
        console.log('   ✅ Method 5: Reverse + base64');
        return { url: decoded, method: 'reverse-base64' };
      }
    } catch (e) {}

    console.log('   ❌ All decoder methods failed');
    return null;
  }

  /**
   * XOR decode with key
   */
  xorDecode(encoded, key) {
    const decoded = Buffer.from(encoded, 'base64');
    const result = [];
    
    for (let i = 0; i < decoded.length; i++) {
      const keyChar = key.charCodeAt(i % key.length);
      result.push(decoded[i] ^ keyChar);
    }
    
    return Buffer.from(result).toString('utf-8');
  }

  /**
   * Resolve CDN placeholders
   */
  resolvePlaceholders(url) {
    const cdnMappings = {
      '#2': 'https://vidsrc.stream',
      '#1': 'https://vidsrc.xyz',
      '#3': 'https://vidsrc.me',
      '#4': 'https://vidsrc.net',
      '#5': 'https://vidsrc.pm'
    };

    const urls = [];
    
    for (const [placeholder, cdn] of Object.entries(cdnMappings)) {
      if (url.includes(placeholder)) {
        urls.push(url.replace(placeholder, cdn));
      }
    }

    // If no placeholders, return original
    if (urls.length === 0) {
      urls.push(url);
    }

    return urls;
  }

  /**
   * Fetch page with proper headers
   */
  fetchPage(url, additionalHeaders = {}) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;
      const zlib = require('zlib');

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          ...additionalHeaders
        }
      };

      const req = client.request(options, (res) => {
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return this.fetchPage(res.headers.location, additionalHeaders)
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
}

// Test execution
if (require.main === module) {
  const extractor = new SuperembedPureFetchExtractor();
  
  // Test with The Shawshank Redemption
  extractor.extract('tt0111161', 'movie')
    .then(result => {
      console.log('\n📊 FINAL RESULT:');
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.error('\n❌ ERROR:', error);
    });
}

module.exports = SuperembedPureFetchExtractor;
