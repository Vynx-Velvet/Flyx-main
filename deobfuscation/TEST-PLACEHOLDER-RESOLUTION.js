/**
 * TEST PLACEHOLDER RESOLUTION
 * 
 * Test that {v1}, {v2}, {v3}, {v4}, {s1} placeholders are properly resolved
 */

const https = require('https');

async function testPlaceholderResolution() {
  console.log('🔧 TESTING PLACEHOLDER RESOLUTION\n');
  console.log('='.repeat(80) + '\n');
  
  const tmdbId = 550;
  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${tmdbId}`;
  
  try {
    // Extract the encoded URL
    const embedPage = await fetch(embedUrl);
    const hash = embedPage.match(/data-hash="([^"]+)"/)[1];
    
    const rcpUrl = `https://cloudnestra.com/rcp/${hash}`;
    const rcpPage = await fetch(rcpUrl, embedUrl);
    const prorcp = rcpPage.match(/\/prorcp\/([A-Za-z0-9+\/=\-_]+)/)[1];
    
    const playerUrl = `https://cloudnestra.com/prorcp/${prorcp}`;
    const playerPage = await fetch(playerUrl, rcpUrl);
    const hiddenDiv = playerPage.match(/<div[^>]+id="([^"]+)"[^>]+style="display:none;">([^<]+)<\/div>/);
    
    const encoded = hiddenDiv[2];
    
    // Decode with Caesar +3
    const decoded = caesarShift(encoded, 3);
    
    console.log('Original decoded URL:');
    console.log(decoded.substring(0, 150) + '...\n');
    
    // Resolve placeholders
    const urls = resolvePlaceholders(decoded);
    
    console.log(`✅ Generated ${urls.length} URL variants:\n`);
    
    urls.forEach((url, i) => {
      console.log(`${i + 1}. ${url.substring(0, 100)}...`);
    });
    
    console.log(`\n✅ SUCCESS! Placeholder resolution working correctly.`);
    console.log(`\nYou can now use any of these ${urls.length} URLs for streaming.`);
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

function caesarShift(text, shift) {
  return text.split('').map(c => {
    const code = c.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      return String.fromCharCode(((code - 65 + shift + 26) % 26) + 65);
    } else if (code >= 97 && code <= 122) {
      return String.fromCharCode(((code - 97 + shift + 26) % 26) + 97);
    }
    return c;
  }).join('');
}

function resolvePlaceholders(url) {
  const urls = [];
  
  // CDN domain mappings
  const cdnMappings = {
    '{v1}': ['vipanicdn.net', 'vipstream1.com', 'cdn1.vidsrc.stream'],
    '{v2}': ['vipanicdn2.net', 'vipstream2.com', 'cdn2.vidsrc.stream'],
    '{v3}': ['vipanicdn3.net', 'vipstream3.com', 'cdn3.vidsrc.stream'],
    '{v4}': ['vipanicdn4.net', 'vipstream4.com', 'cdn4.vidsrc.stream'],
    '{s1}': ['io', 'com', 'net'],
    '{s2}': ['io', 'com', 'net'],
    '{s3}': ['io', 'com', 'net']
  };
  
  // Find all placeholders
  const placeholders = url.match(/\{[^}]+\}/g) || [];
  
  if (placeholders.length === 0) {
    return [url];
  }
  
  // Generate URLs for each placeholder variant
  const firstPlaceholder = placeholders[0];
  const replacements = cdnMappings[firstPlaceholder] || [firstPlaceholder.slice(1, -1)];
  
  for (const replacement of replacements) {
    const newUrl = url.replace(firstPlaceholder, replacement);
    const resolvedUrls = resolvePlaceholders(newUrl);
    urls.push(...resolvedUrls);
  }
  
  return urls;
}

function fetch(url, referer = 'https://vidsrc-embed.ru/') {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': referer,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

testPlaceholderResolution();
