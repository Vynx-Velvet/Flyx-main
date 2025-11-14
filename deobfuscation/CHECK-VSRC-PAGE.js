const https = require('https');
const fs = require('fs');

const url = 'https://streamsrcs.2embed.cc/vsrc?imdb=tt0111161';

https.get(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html',
    'Referer': 'https://www.2embed.cc/'
  }
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    fs.writeFileSync('deobfuscation/vsrc-page.html', data);
    console.log('Saved! Length:', data.length);
    console.log('\nContent preview:');
    console.log(data.substring(0, 1000));
    
    console.log('\n\nSearching for patterns:');
    console.log('Has data-hash:', data.includes('data-hash'));
    console.log('Has data-h:', data.includes('data-h'));
    console.log('Has PRO:', data.includes('PRO'));
    console.log('Has rcp:', data.includes('rcp'));
    console.log('Has m3u8:', data.includes('.m3u8'));
    
    // Look for any data attributes
    const dataAttrs = [...data.matchAll(/data-([^=\s]+)=["']([^"']+)["']/gi)];
    console.log(`\nFound ${dataAttrs.length} data attributes:`);
    dataAttrs.slice(0, 10).forEach(attr => {
      console.log(`  data-${attr[1]}="${attr[2]}"`);
    });
  });
}).on('error', err => console.error(err.message));
