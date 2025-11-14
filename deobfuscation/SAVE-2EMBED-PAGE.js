const https = require('https');
const fs = require('fs');

const url = 'https://www.2embed.cc/embed/tmdb/movie?id=278';

https.get(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html'
  }
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    fs.writeFileSync('deobfuscation/2embed-tmdb-278.html', data);
    console.log('Saved! Length:', data.length);
    console.log('\nSearching for key patterns:');
    console.log('Has data-hash:', data.includes('data-hash'));
    console.log('Has iframe:', data.includes('<iframe'));
    console.log('Has swish:', data.includes('swish'));
    console.log('Has streamsrcs:', data.includes('streamsrcs'));
    
    // Show all iframes
    const iframes = [...data.matchAll(/<iframe[^>]+>/gi)];
    console.log(`\nFound ${iframes.length} iframes:`);
    iframes.forEach((iframe, i) => {
      console.log(`${i + 1}. ${iframe[0]}`);
    });
  });
}).on('error', err => console.error(err.message));
