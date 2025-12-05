/**
 * Test script for 2Embed extractor validation
 * Tests multiple known titles to verify correct content extraction
 */

const TEST_CASES = [
  // Latest 2025 Movies
  { name: 'Wicked (2024)', imdbId: 'tt1262426', tmdbId: '402431', type: 'movie', expectedKeywords: ['wicked'] },
  { name: 'Moana 2 (2024)', imdbId: 'tt13622970', tmdbId: '1241982', type: 'movie', expectedKeywords: ['moana'] },
  { name: 'Gladiator II (2024)', imdbId: 'tt9218128', tmdbId: '558449', type: 'movie', expectedKeywords: ['gladiator'] },
  { name: 'Red One (2024)', imdbId: 'tt14948432', tmdbId: '845781', type: 'movie', expectedKeywords: ['red', 'one'] },
  { name: 'Kraven the Hunter (2024)', imdbId: 'tt8790086', tmdbId: '539972', type: 'movie', expectedKeywords: ['kraven', 'hunter'] },
  { name: 'Mufasa: The Lion King (2024)', imdbId: 'tt13186482', tmdbId: '762509', type: 'movie', expectedKeywords: ['mufasa', 'lion'] },
  
  // Latest TV Shows - December 2025
  { name: 'Squid Game S2E1', imdbId: 'tt10919420', tmdbId: '93405', type: 'tv', season: 2, episode: 1, expectedKeywords: ['squid', 'game'] },
  { name: 'Severance S2E1', imdbId: 'tt11280740', tmdbId: '95396', type: 'tv', season: 2, episode: 1, expectedKeywords: ['severance'] },
  { name: 'The White Lotus S3E1', imdbId: 'tt13406094', tmdbId: '111803', type: 'tv', season: 3, episode: 1, expectedKeywords: ['white', 'lotus'] },
  { name: 'Yellowstone S5E9', imdbId: 'tt4236770', tmdbId: '73586', type: 'tv', season: 5, episode: 9, expectedKeywords: ['yellowstone'] },
];

// Fetch with proper headers
async function fetchWithHeaders(url, referer, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': referer || '',
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Extract source name from URL
function extractSourceName(url) {
  try {
    const urlObj = new URL(url);
    const parts = urlObj.hostname.split('.');
    let mainPart = parts.length >= 3 ? parts[parts.length - 2] : parts[0];
    return mainPart.charAt(0).toUpperCase() + mainPart.slice(1).toLowerCase();
  } catch {
    return 'Unknown';
  }
}

// Decode JWPlayer config
function decodeJWPlayer(html) {
  const evalStart = html.indexOf("eval(function(p,a,c,k,e,d)");
  if (evalStart === -1) return null;

  let depth = 0;
  let evalEnd = -1;
  for (let i = evalStart + 4; i < html.length; i++) {
    if (html[i] === '(') depth++;
    if (html[i] === ')') {
      depth--;
      if (depth === 0) {
        evalEnd = i;
        break;
      }
    }
  }

  const evalStr = html.substring(evalStart, evalEnd + 1);
  const argsMatch = evalStr.match(/\}\('(.+)',(\d+),(\d+),'(.+)'\.split\('\|'\)\)\)$/);
  if (!argsMatch) return null;

  const [, packed, radix, count, dictionaryStr] = argsMatch;
  const dictionary = dictionaryStr.split('|');

  let decoded = packed;
  for (let i = parseInt(count) - 1; i >= 0; i--) {
    if (dictionary[i]) {
      const regex = new RegExp('\\b' + i.toString(parseInt(radix)) + '\\b', 'g');
      decoded = decoded.replace(regex, dictionary[i]);
    }
  }

  const sourcesMatch = decoded.match(/\{[^}]*"hls\d+"[^}]*\}/);
  if (!sourcesMatch) return null;

  try {
    return JSON.parse(sourcesMatch[0]);
  } catch {
    return null;
  }
}

// Test a single title
async function testTitle(testCase) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${testCase.name}`);
  console.log(`IMDB: ${testCase.imdbId}, TMDB: ${testCase.tmdbId}`);
  console.log('='.repeat(60));

  try {
    // Step 1: Fetch 2embed page
    const embedUrl = testCase.type === 'tv'
      ? `https://www.2embed.cc/embedtv/${testCase.imdbId}&s=${testCase.season}&e=${testCase.episode}`
      : `https://www.2embed.cc/embed/${testCase.imdbId}`;
    
    console.log(`\n[1] Fetching: ${embedUrl}`);
    const embedResponse = await fetchWithHeaders(embedUrl);
    const embedHtml = await embedResponse.text();
    
    if (embedHtml.includes('not found') || embedHtml.length < 1000) {
      console.log('❌ Content not found on 2embed');
      return { success: false, error: 'Not found' };
    }
    console.log(`✓ Got embed page (${embedHtml.length} bytes)`);

    // Step 2: Find player4u URL
    const serverRegex = /onclick="go\('([^']+)'\)"/g;
    const serverMatches = Array.from(embedHtml.matchAll(serverRegex));
    const player4uMatch = serverMatches.find(m => m[1].includes('player4u'));
    
    if (!player4uMatch) {
      console.log('❌ No player4u URL found');
      console.log('Available servers:', serverMatches.map(m => m[1].substring(0, 50)).join('\n  '));
      return { success: false, error: 'No player4u' };
    }
    
    const player4uUrl = player4uMatch[1];
    console.log(`\n[2] Found player4u: ${player4uUrl.substring(0, 80)}...`);

    // Step 3: Fetch player4u page
    const player4uResponse = await fetchWithHeaders(player4uUrl, embedUrl);
    const player4uHtml = await player4uResponse.text();
    console.log(`✓ Got player4u page (${player4uHtml.length} bytes)`);

    // Step 4: Extract quality options
    const qualityRegex = /go\('([^']+)'\)/g;
    const qualityMatches = Array.from(player4uHtml.matchAll(qualityRegex));
    
    console.log(`\n[3] Found ${qualityMatches.length} quality options`);
    
    // Extract titles from URLs
    const sources = [];
    for (let i = 0; i < Math.min(qualityMatches.length, 5); i++) {
      const url = qualityMatches[i][1];
      const titleMatch = url.match(/tit=([^&]+)/);
      const title = titleMatch ? decodeURIComponent(titleMatch[1].replace(/\+/g, ' ')) : 'Unknown';
      
      console.log(`  [${i + 1}] Title: "${title}"`);
      sources.push({ url, title });
    }

    // Step 5: Test first source extraction
    if (sources.length > 0) {
      console.log(`\n[4] Testing first source extraction...`);
      const firstSource = sources[0];
      
      const swpUrl = `https://player4u.xyz${firstSource.url}`;
      const swpResponse = await fetchWithHeaders(swpUrl, player4uUrl);
      const swpHtml = await swpResponse.text();
      
      const iframeMatch = swpHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i);
      if (!iframeMatch) {
        console.log('❌ No iframe found in swp page');
        return { success: false, error: 'No iframe' };
      }
      
      const iframeId = iframeMatch[1];
      const yesmoviesUrl = `https://yesmovies.baby/e/${iframeId}`;
      console.log(`  → yesmovies URL: ${yesmoviesUrl}`);
      
      const yesmoviesResponse = await fetchWithHeaders(yesmoviesUrl, swpUrl);
      const yesmoviesHtml = await yesmoviesResponse.text();
      
      const jwSources = decodeJWPlayer(yesmoviesHtml);
      if (!jwSources) {
        console.log('❌ Failed to decode JWPlayer config');
        return { success: false, error: 'JWPlayer decode failed' };
      }
      
      const streamUrl = jwSources.hls3 || jwSources.hls2 || jwSources.hls4;
      if (!streamUrl) {
        console.log('❌ No stream URL in JWPlayer config');
        return { success: false, error: 'No stream URL' };
      }
      
      const finalUrl = streamUrl.startsWith('http') ? streamUrl : `https://yesmovies.baby${streamUrl}`;
      const sourceName = extractSourceName(finalUrl);
      
      console.log(`\n[5] STREAM EXTRACTED:`);
      console.log(`  Source: ${sourceName}`);
      console.log(`  URL: ${finalUrl.substring(0, 80)}...`);
      
      // Validate content by checking title keywords
      const allTitles = sources.map(s => s.title.toLowerCase()).join(' ');
      const matchedKeywords = testCase.expectedKeywords.filter(kw => allTitles.includes(kw.toLowerCase()));
      
      console.log(`\n[6] CONTENT VALIDATION:`);
      console.log(`  Expected keywords: ${testCase.expectedKeywords.join(', ')}`);
      console.log(`  Found in titles: ${matchedKeywords.join(', ') || 'NONE'}`);
      
      if (matchedKeywords.length > 0) {
        console.log(`\n✅ SUCCESS - Content appears to match "${testCase.name}"`);
        return { success: true, sourceName, streamUrl: finalUrl, matchedKeywords };
      } else {
        console.log(`\n⚠️ WARNING - Content may not match! Titles found:`);
        sources.forEach(s => console.log(`    - ${s.title}`));
        return { success: false, error: 'Content mismatch', titles: sources.map(s => s.title) };
      }
    }
    
    return { success: false, error: 'No sources found' };
    
  } catch (error) {
    console.log(`\n❌ ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Main test runner
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         2EMBED EXTRACTOR VALIDATION TEST                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const results = [];
  
  for (const testCase of TEST_CASES) {
    const result = await testTitle(testCase);
    results.push({ name: testCase.name, ...result });
    
    // Small delay between tests
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Summary
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed}\n`);
  
  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    const detail = result.success 
      ? `Source: ${result.sourceName}` 
      : `Error: ${result.error}`;
    console.log(`${status} ${result.name}: ${detail}`);
  }
  
  if (failed > 0) {
    console.log('\n⚠️ Some tests failed - 2embed may be returning incorrect content!');
  } else {
    console.log('\n✅ All tests passed - 2embed extraction working correctly!');
  }
}

runTests().catch(console.error);
