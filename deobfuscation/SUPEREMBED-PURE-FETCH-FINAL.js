/**
 * SUPEREMBED PURE FETCH EXTRACTOR - FINAL
 * 
 * Following the proven cloudstream methodology:
 * 1. Fetch VidSrc embed page (vidsrc.xyz)
 * 2. Extract Superembed hash from page
 * 3. Fetch CloudNestra RCP page
 * 4. Extract ProRCP URL
 * 5. Fetch ProRCP player page
 * 6. Extract hidden div with encoded data
 * 7. Try all decoders to get M3U8 URL
 * 8. Resolve CDN placeholders
 * 
 * This matches the exact flow used for cloudstream/2embed
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const zlib = require('zlib');
const fs = require('fs');

class SuperembedPureFetchExtractor {
  constructor() {
    this.vidsrcBaseUrl = 'https://vidsrc.xyz/embed';
    this.rcpBaseUrl = 'https://cloudnestra.com/rcp';
  }

  /**
   * Main extraction method
   */
  async extract(tmdbId, type = 'movie', season = null, episode = null) {
    console.log('\n🎬 SUPEREMBED PURE FETCH EXTRACTION');
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
      console.log('✅ Step 1: VidSrc URL');
      console.log(`   ${vidsrcUrl}\n`);

      // Step 2: Fetch VidSrc page
      console.log('⏳ Step 2: Fetching VidSrc embed page...');
      const vidsrcHtml = await this.fetchPage(vidsrcUrl);
      console.log(`✅ Fetched (${vidsrcHtml.length} bytes)\n`);
      fs.writeFileSync('deobfuscation/superembed-vidsrc.html', vidsrcHtml);

      // Step 3: Extract Superembed hash
      console.log('⏳ Step 3: Extracting Superembed hash...');
      const hash = this.extractSuperembedHash(vidsrcHtml);
      if (!hash) {
        throw new Error('Superembed hash not found');
      }
      console.log(`✅ Hash: ${hash.substring(0, 60)}...\n`);

      // Step 4: Fetch RCP page
      console.log('⏳ Step 4: Fetching CloudNestra RCP page...');
      const rcpUrl = `${this.rcpBaseUrl}/${hash}`;
      const rcpHtml = await this.fetchPage(rcpUrl, vidsrcUrl);
      console.log(`✅ Fetched (${rcpHtml.length} bytes)\n`);
      fs.writeFileSync('deobfuscation/superembed-rcp.html', rcpHtml);

      // Step 5: Extract ProRCP URL
      console.log('⏳ Step 5: Extracting ProRCP URL...');
      const proRcpUrl = this.extractProRcpUrl(rcpHtml);
      if (!proRcpUrl) {
        throw new Error('ProRCP URL not found');
      }
      console.log(`✅ ProRCP: ${proRcpUrl}\n`);

      // Step 6: Fetch ProRCP player page
      console.log('⏳ Step 6: Fetching ProRCP player page...');
      const playerHtml = await this.fetchPage(proRcpUrl, rcpUrl);
      console.log(`✅ Fetched (${playerHtml.length} bytes)\n`);
      fs.writeFileSync('deobfuscation/superembed-player.html', playerHtml);

      // Step 7: Extract hidden div
      console.log('⏳ Step 7: Extracting hidden div...');
      const hiddenDiv = this.extractHiddenDiv(playerHtml);
      if (!hiddenDiv) {
        throw new Error('Hidden div not found');
      }
      console.log(`✅ Div ID: ${hiddenDiv.divId}`);
      console.log(`   Encoded: ${hiddenDiv.encoded.length} chars\n`);

      // Step 8: Decode M3U8 URL
      console.log('⏳ Step 8: Decoding M3U8 URL...');
      const decoded = this.tryAllDecoders(hiddenDiv.encoded, hiddenDiv.divId);
      if (!decoded) {
        throw new Error('All decoders failed');
      }
      console.log(`✅ Method: ${decoded.method}`);
      console.log(`   URL: ${decoded.url}\n`);

      // Step 9: Resolve placeholders
      console.log('⏳ Step 9: Resolving CDN placeholders...');
      const m3u8Urls = this.resolvePlaceholders(decoded.url);
      console.log(`✅ Resolved to ${m3u8Urls.length} CDN variants\n`);

      const duration = Date.now() - startTime;

      console.log('='.repeat(80));
      console.log(`✅ EXTRACTION COMPLETE in ${duration}ms`);
      console.log('='.repeat(80));
      console.log(`\nPrimary M3U8: ${m3u8Urls[0]}\n`);

      return {
        success: true,
        m3u8Url: m3u8Urls[0],
        m3u8Urls,
        method: decoded.method,
        duration,
        steps: {
          vidsrcUrl,
          hash,
          rcpUrl,
          proRcpUrl,
          hiddenDiv
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`\n❌ EXTRACTION FAILED: ${error.message}`);
      console.error(`   Duration: ${duration}ms\n`);
      
      return {
        success: false,
        error: error.message,
        duration
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
   * Extract Superembed hash from VidSrc HTML
   * Patterns based on proven 2embed/cloudstream extraction
   */
  extractSuperembedHash(html) {
    // Pattern 1: data-hash with Superembed nearby
    let match = html.match(/data-hash=["']([^"']+)["'][^>]*>[^<]*Superembed/i);
    if (match) return match[1];

    // Pattern 2: Superembed with data-hash nearby
    match = html.match(/Superembed[^<]*<[^>]*data-hash=["']([^"']+)["']/i);
    if (match) return match[1];

    // Pattern 3: data-id="superembed" with data-hash
    match = html.match(/data-id=["']superembed["'][^>]*data-hash=["']([^"']+)["']/i);
    if (match) return match[1];

    // Pattern 4: data-hash with data-id="superembed"
    match = html.match(/data-hash=["']([^"']+)["'][^>]*data-id=["']superembed["']/i);
    if (match) return match[1];

    // Pattern 5: Look for any base64 hash near "superembed" (case insensitive)
    const superembedIndex = html.toLowerCase().indexOf('superembed');
    if (superembedIndex !== -1) {
      const context = html.substring(Math.max(0, superembedIndex - 500), superembedIndex + 500);
      match = context.match(/data-hash=["']([A-Za-z0-9+/=]{40,})["']/);
      if (match) return match[1];
    }

    return null;
  }

  /**
   * Extract ProRCP URL from RCP HTML
   */
  extractProRcpUrl(html) {
    // Pattern 1: srcrcp path (most common for superembed)
    let match = html.match(/srcrcp\/([A-Za-z0-9+/=]+)/);
    if (match) return this.normalizeUrl('/srcrcp/' + match[1]);

    // Pattern 2: prorcp path
    match = html.match(/prorcp\/([A-Za-z0-9+/=]+)/);
    if (match) return this.normalizeUrl('/prorcp/' + match[1]);

    // Pattern 3: jQuery iframe with prorcp
    match = html.match(/\$\(['"]<iframe>['"]\)\.attr\(['"]src['"],\s*['"]([^'"]*prorcp[^'"]*)['"]/i);
    if (match) return this.normalizeUrl(match[1]);

    // Pattern 4: Direct iframe with prorcp
    match = html.match(/<iframe[^>]+src=["']([^"']*prorcp[^"']*)["']/i);
    if (match) return this.normalizeUrl(match[1]);

    // Pattern 5: Variable assignment with prorcp
    match = html.match(/var\s+\w+\s*=\s*["']([^"']*prorcp[^"']*)["']/i);
    if (match) return this.normalizeUrl(match[1]);

    // Pattern 6: jQuery iframe with srcrcp
    match = html.match(/\$\(['"]<iframe>['"]\)\.attr\(['"]src['"],\s*['"]([^'"]*srcrcp[^'"]*)['"]/i);
    if (match) return this.normalizeUrl(match[1]);

    // Pattern 7: Direct iframe with srcrcp
    match = html.match(/<iframe[^>]+src=["']([^"']*srcrcp[^"']*)["']/i);
    if (match) return this.normalizeUrl(match[1]);

    return null;
  }

  /**
   * Normalize URL (add domain if relative)
   */
  normalizeUrl(url) {
    if (url.startsWith('http')) {
      return url;
    } else if (url.startsWith('//')) {
      return 'https:' + url;
    } else if (url.startsWith('/')) {
      return 'https://cloudnestra.com' + url;
    }
    return url;
  }

  /**
   * Extract hidden div with encoded data
   */
  extractHiddenDiv(html) {
    // Pattern 1: div with display:none and id
    let match = html.match(/<div[^>]+id=["']([^"']+)["'][^>]*style=["'][^"']*display:\s*none[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    if (match) {
      const content = match[2].trim();
      if (content.length > 100 && /^[A-Za-z0-9+/=\s]+$/.test(content)) {
        return { divId: match[1], encoded: content.replace(/\s/g, '') };
      }
    }

    // Pattern 2: div with style first, then id
    match = html.match(/<div[^>]+style=["'][^"']*display:\s*none[^"']*["'][^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/div>/i);
    if (match) {
      const content = match[2].trim();
      if (content.length > 100 && /^[A-Za-z0-9+/=\s]+$/.test(content)) {
        return { divId: match[1], encoded: content.replace(/\s/g, '') };
      }
    }

    // Pattern 3: Any hidden div with long base64-like content
    const hiddenDivs = [...html.matchAll(/<div[^>]*style=["'][^"']*display:\s*none[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)];
    for (const div of hiddenDivs) {
      const content = div[1].trim();
      if (content.length > 100 && /^[A-Za-z0-9+/=\s]+$/.test(content)) {
        // Extract ID if present
        const idMatch = div[0].match(/id=["']([^"']+)["']/);
        const divId = idMatch ? idMatch[1] : 'unknown';
        return { divId, encoded: content.replace(/\s/g, '') };
      }
    }

    return null;
  }

  /**
   * Try all known decoding methods
   */
  tryAllDecoders(encoded, divId) {
    const decoders = [
      { name: 'base64', fn: this.decodeBase64.bind(this) },
      { name: 'base64-url', fn: this.decodeBase64Url.bind(this) },
      { name: 'xor-divid', fn: this.decodeXorDivId.bind(this) },
      { name: 'hex', fn: this.decodeHex.bind(this) },
      { name: 'reverse-base64', fn: this.decodeReverseBase64.bind(this) },
    ];

    for (const decoder of decoders) {
      try {
        const result = decoder.fn(encoded, divId);
        if (result && (result.includes('.m3u8') || result.includes('http'))) {
          return { url: result, method: decoder.name };
        }
      } catch (e) {
        // Continue to next decoder
      }
    }

    return null;
  }

  decodeBase64(encoded) {
    return Buffer.from(encoded, 'base64').toString('utf-8');
  }

  decodeBase64Url(encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    return decodeURIComponent(decoded);
  }

  decodeXorDivId(encoded, divId) {
    const decoded = Buffer.from(encoded, 'base64');
    const result = [];
    for (let i = 0; i < decoded.length; i++) {
      const keyChar = divId.charCodeAt(i % divId.length);
      result.push(decoded[i] ^ keyChar);
    }
    return Buffer.from(result).toString('utf-8');
  }

  decodeHex(encoded) {
    if (!/^[0-9a-fA-F]+$/.test(encoded)) return null;
    return Buffer.from(encoded, 'hex').toString('utf-8');
  }

  decodeReverseBase64(encoded) {
    const reversed = encoded.split('').reverse().join('');
    return Buffer.from(reversed, 'base64').toString('utf-8');
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

    return urls.length > 0 ? urls : [url];
  }

  /**
   * Fetch page with compression support
   */
  fetchPage(url, referer = null) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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

      const req = client.request(options, (res) => {
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return this.fetchPage(res.headers.location, referer)
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
      
      if (result.success) {
        console.log('\n✅ SUCCESS! M3U8 URL extracted using pure fetch.');
        console.log(`\nTest the URL:\ncurl -I "${result.m3u8Url}"\n`);
      }
    })
    .catch(error => {
      console.error('\n❌ ERROR:', error);
    });
}

module.exports = SuperembedPureFetchExtractor;
