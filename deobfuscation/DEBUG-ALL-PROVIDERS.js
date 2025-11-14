/**
 * DEBUG ALL PROVIDERS
 * Check what we're actually getting from each provider
 */

const https = require('https');
const fs = require('fs');

const TMDB_ID = 'tt0111161';

const providers = [
  { name: 'VidSrc.xyz', url: `https://vidsrc.xyz/embed/movie/${TMDB_ID}` },
  { name: 'VidSrc.stream', url: `https://vidsrc.stream/embed/movie/${TMDB_ID}` },
  { name: '2Embed.cc', url: `https://www.2embed.cc/embed/${TMDB_ID}` }
];

async function debugProviders() {
  for (const provider of providers) {
    console.log(`\nFetching ${provider.name}...`);
    
    try {
      const page = await fetchPage(provider.url);
      const filename = `debug-${provider.name.replace(/\./g, '-')}.html`;
      fs.writeFileSync(`deobfuscation/${filename}`, page);
      
      console.log(`✅ Saved to ${filename}`);
      console.log(`   Length: ${page.length} bytes`);
      console.log(`   Has hash: ${page.includes('data-hash')}`);
      console.log(`   Has iframe: ${page.includes('<iframe')}`);
      console.log(`   Has script: ${page.includes('<script')}`);
      
      // Show first 500 chars
      console.log(`   Preview: ${page.substring(0, 500).replace(/\n/g, ' ')}...`);
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

debugProviders();
