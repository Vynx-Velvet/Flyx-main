/**
 * COMPREHENSIVE SUCCESS RATE TEST
 * 
 * Test extraction across multiple content items and servers
 * to achieve 90%+ success rate
 */

const https = require('https');

// Test dataset with diverse content
const TEST_CONTENT = [
  { tmdbId: 550, type: 'movie', title: 'Fight Club' },
  { tmdbId: 278, type: 'movie', title: 'The Shawshank Redemption' },
  { tmdbId: 238, type: 'movie', title: 'The Godfather' },
  { tmdbId: 424, type: 'movie', title: 'Schindler\'s List' },
  { tmdbId: 680, type: 'movie', title: 'Pulp Fiction' },
  { tmdbId: 155, type: 'movie', title: 'The Dark Knight' },
  { tmdbId: 13, type: 'movie', title: 'Forrest Gump' },
  { tmdbId: 497, type: 'movie', title: 'The Green Mile' },
  { tmdbId: 637, type: 'movie', title: 'Life Is Beautiful' },
  { tmdbId: 429, type: 'movie', title: 'The Good, the Bad and the Ugly' },
  { tmdbId: 1396, type: 'tv', season: 1, episode: 1, title: 'Breaking Bad S01E01' },
  { tmdbId: 1399, type: 'tv', season: 1, episode: 1, title: 'Game of Thrones S01E01' },
  { tmdbId: 60735, type: 'tv', season: 1, episode: 1, title: 'The Flash S01E01' },
  { tmdbId: 1418, type: 'tv', season: 1, episode: 1, title: 'The Big Bang Theory S01E01' },
  { tmdbId: 46952, type: 'tv', season: 1, episode: 1, title: 'The Blacklist S01E01' }
];

async function comprehensiveTest() {
  console.log('🎯 COMPREHENSIVE SUCCESS RATE TEST\n');
  console.log('='.repeat(80) + '\n');
  console.log(`Testing ${TEST_CONTENT.length} content items...\n\n`);
  
  const results = {
    total: TEST_CONTENT.length,
    successful: 0,
    failed: 0,
    details: []
  };
  
  for (let i = 0; i < TEST_CONTENT.length; i++) {
    const content = TEST_CONTENT[i];
    console.log(`[${i + 1}/${TEST_CONTENT.length}] Testing: ${content.title}`);
    console.log('-'.repeat(80));
    
    try {
      const url = await extractM3U8(content);
      
      if (url && url.includes('http')) {
        console.log(`✅ SUCCESS: ${url.substring(0, 80)}...\n`);
        results.successful++;
        results.details.push({
          content: content.title,
          status: 'SUCCESS',
          url: url.substring(0, 100)
        });
      } else {
        console.log(`❌ FAILED: No valid URL extracted\n`);
        results.failed++;
        results.details.push({
          content: content.title,
          status: 'FAILED',
          reason: 'No valid URL'
        });
      }
    } catch (error) {
      console.log(`❌ FAILED: ${error.message}\n`);
      results.failed++;
      results.details.push({
        content: content.title,
        status: 'FAILED',
        reason: error.message
      });
    }
    
    // Small delay between requests
    await sleep(500);
  }
  
  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST RESULTS SUMMARY\n');
  console.log('='.repeat(80) + '\n');
  
  const successRate = (results.successful / results.total * 100).toFixed(2);
  
  console.log(`Total Tests: ${results.total}`);
  console.log(`Successful: ${results.successful}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Success Rate: ${successRate}%\n`);
  
  if (parseFloat(successRate) >= 90) {
    console.log('🎉 SUCCESS! Achieved 90%+ success rate!\n');
  } else {
    console.log(`⚠️  Need improvement. Target: 90%, Current: ${successRate}%\n`);
  }
  
  // Detailed breakdown
  console.log('Detailed Results:');
  console.log('-'.repeat(80));
  results.details.forEach((detail, idx) => {
    const icon = detail.status === 'SUCCESS' ? '✅' : '❌';
    console.log(`${icon} ${idx + 1}. ${detail.content}`);
    if (detail.status === 'FAILED') {
      console.log(`   Reason: ${detail.reason}`);
    }
  });
  
  return results;
}

async function extractM3U8(content) {
  const { tmdbId, type, season, episode } = content;
  
  // Build embed URL
  let embedUrl = `https://vidsrc-embed.ru/embed/${type}/${tmdbId}`;
  if (type === 'tv' && season && episode) {
    embedUrl += `/${season}/${episode}`;
  }
  
  try {
    // Step 1: Get embed page
    const embedPage = await fetch(embedUrl);
    
    // Extract hash
    const hashMatch = embedPage.match(/data-hash="([^"]+)"/);
    if (!hashMatch) {
      throw new Error('No hash found in embed page');
    }
    
    const hash = hashMatch[1];
    
    // Step 2: Get RCP page
    const rcpUrl = `https://cloudnestra.com/rcp/${hash}`;
    const rcpPage = await fetch(rcpUrl, embedUrl);
    
    // Extract prorcp
    const prorcpMatch = rcpPage.match(/\/prorcp\/([A-Za-z0-9+\/=\-_]+)/);
    if (!prorcpMatch) {
      throw new Error('No prorcp found in RCP page');
    }
    
    const prorcp = prorcpMatch[1];
    
    // Step 3: Get player page
    const playerUrl = `https://cloudnestra.com/prorcp/${prorcp}`;
    const playerPage = await fetch(playerUrl, rcpUrl);
    
    // Extract hidden div
    const hiddenDivMatch = playerPage.match(
      /<div[^>]+id="([^"]+)"[^>]+style="display:none;">([^<]+)<\/div>/
    );
    
    if (!hiddenDivMatch) {
      throw new Error('No hidden div found in player page');
    }
    
    const encoded = hiddenDivMatch[2];
    
    // Step 4: Decode using Caesar -3
    const decoded = caesarDecode(encoded, -3);
    
    if (!decoded || !decoded.includes('http')) {
      throw new Error('Decoding failed or invalid URL');
    }
    
    return decoded;
    
  } catch (error) {
    throw error;
  }
}

function caesarDecode(text, shift) {
  return text.split('').map(c => {
    const code = c.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      return String.fromCharCode(((code - 65 - shift + 26) % 26) + 65);
    } else if (code >= 97 && code <= 122) {
      return String.fromCharCode(((code - 97 - shift + 26) % 26) + 97);
    }
    return c;
  }).join('');
}

function fetch(url, referer = 'https://vidsrc-embed.ru/') {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': referer,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

if (require.main === module) {
  comprehensiveTest().then(results => {
    const successRate = (results.successful / results.total * 100).toFixed(2);
    process.exit(parseFloat(successRate) >= 90 ? 0 : 1);
  }).catch(error => {
    console.error('Test suite error:', error);
    process.exit(1);
  });
}

module.exports = { comprehensiveTest, extractM3U8 };
