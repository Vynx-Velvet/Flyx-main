/**
 * Live test for 2Embed extractor using TMDB API
 * Fetches top 5 latest movies and TV shows, then tests 2embed extraction
 */

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || process.env.TMDB_API_KEY;

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

// Fetch from TMDB API
async function fetchTMDB(endpoint) {
  const response = await fetch(`https://api.themoviedb.org/3${endpoint}?api_key=${TMDB_API_KEY}`);
  return response.json();
}

// Get IMDB ID for a title
async function getImdbId(tmdbId, type) {
  const data = await fetchTMDB(`/${type}/${tmdbId}/external_ids`);
  return data.imdb_id;
}

// Get latest episode for a TV show
async function getLatestEpisode(tmdbId) {
  const data = await fetchTMDB(`/tv/${tmdbId}`);
  if (data.last_episode_to_air) {
    return {
      season: data.last_episode_to_air.season_number,
      episode: data.last_episode_to_air.episode_number,
      name: data.last_episode_to_air.name
    };
  }
  return { season: 1, episode: 1, name: 'Pilot' };
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

/**
 * Check if a source title matches the expected content
 */
function isContentMatch(sourceTitle, expectedTitle, season, episode) {
  const sourceLower = sourceTitle.toLowerCase();
  const expectedLower = expectedTitle.toLowerCase();
  
  // Block obvious adult content
  const adultKeywords = ['porn', 'xxx', 'adult', 'sex', 'nude', 'erotic', 'onlyfans', 'brazzers', 'pornhub', 'xvideos'];
  for (const keyword of adultKeywords) {
    if (sourceLower.includes(keyword)) {
      return { match: false, reason: 'Adult content blocked' };
    }
  }
  
  // Extract key words from expected title
  const stopWords = ['the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or', 'but'];
  const expectedWords = expectedLower
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.includes(w));
  
  // Check word match
  let matchCount = 0;
  for (const word of expectedWords) {
    if (sourceLower.includes(word)) {
      matchCount++;
    }
  }
  
  const matchRatio = expectedWords.length > 0 ? matchCount / expectedWords.length : 0;
  
  // For TV shows, check season/episode
  if (season !== undefined && episode !== undefined) {
    const sePattern = new RegExp(`s0?${season}e0?${episode}|season\\s*${season}.*episode\\s*${episode}`, 'i');
    const hasCorrectEpisode = sePattern.test(sourceTitle);
    
    const anyEpisodePattern = /s\d+e\d+|season\s*\d+.*episode\s*\d+/i;
    if (anyEpisodePattern.test(sourceTitle) && !hasCorrectEpisode) {
      return { match: false, reason: `Wrong episode (expected S${season}E${episode})` };
    }
  }
  
  if (matchRatio < 0.4) {
    return { match: false, reason: `Title mismatch (${Math.round(matchRatio * 100)}% match)` };
  }
  
  return { match: true, matchRatio };
}

// Test 2embed extraction for a title
async function test2Embed(title, imdbId, tmdbId, type, season, episode) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`📺 ${title}`);
  console.log(`   IMDB: ${imdbId} | TMDB: ${tmdbId} | Type: ${type}`);
  if (type === 'tv') console.log(`   Season ${season}, Episode ${episode}`);
  console.log('─'.repeat(70));

  try {
    // Step 1: Fetch 2embed page
    const embedUrl = type === 'tv'
      ? `https://www.2embed.cc/embedtv/${imdbId}&s=${season}&e=${episode}`
      : `https://www.2embed.cc/embed/${imdbId}`;
    
    console.log(`\n[1] Fetching 2embed: ${embedUrl}`);
    const embedResponse = await fetchWithHeaders(embedUrl);
    const embedHtml = await embedResponse.text();
    
    if (embedHtml.includes('not found') || embedHtml.length < 1000) {
      console.log('   ❌ Content not found on 2embed');
      return { success: false, error: 'Not found' };
    }
    console.log(`   ✓ Got embed page (${embedHtml.length} bytes)`);

    // Step 2: Find player4u URL
    const serverRegex = /onclick="go\('([^']+)'\)"/g;
    const serverMatches = Array.from(embedHtml.matchAll(serverRegex));
    const player4uMatch = serverMatches.find(m => m[1].includes('player4u'));
    
    if (!player4uMatch) {
      console.log('   ❌ No player4u URL found');
      return { success: false, error: 'No player4u' };
    }
    
    const player4uUrl = player4uMatch[1];
    console.log(`\n[2] Found player4u URL`);

    // Step 3: Fetch player4u page
    const player4uResponse = await fetchWithHeaders(player4uUrl, embedUrl);
    const player4uHtml = await player4uResponse.text();
    console.log(`   ✓ Got player4u page (${player4uHtml.length} bytes)`);

    // Step 4: Extract quality options and their titles
    const qualityRegex = /go\('([^']+)'\)/g;
    const qualityMatches = Array.from(player4uHtml.matchAll(qualityRegex));
    
    console.log(`\n[3] Found ${qualityMatches.length} source options`);
    
    // Extract titles from <li> elements (new format)
    const liRegex = /<li[^>]*><a[^>]*onclick="go\('([^']+)'\)"[^>]*>.*?&nbsp;\s*([^<]+)<\/a><\/li>/gi;
    const liMatches = Array.from(player4uHtml.matchAll(liRegex));
    
    const sources = [];
    for (const match of liMatches) {
      const url = match[1];
      const sourceTitle = match[2]?.trim() || '';
      sources.push({ url, title: sourceTitle });
    }

    // Show first 5 source titles with validation
    console.log('\n   Source titles found:');
    let validSources = 0;
    for (let i = 0; i < Math.min(5, sources.length); i++) {
      const s = sources[i];
      const validation = isContentMatch(s.title, title, season, episode);
      const status = validation.match ? '✓' : '✗';
      const reason = validation.match ? '' : ` (${validation.reason})`;
      console.log(`   [${i + 1}] ${status} "${s.title || 'No title'}"${reason}`);
      if (validation.match) validSources++;
    }
    
    // Count total valid sources
    const allValidSources = sources.filter(s => isContentMatch(s.title, title, season, episode).match);
    console.log(`\n   Content validation: ${allValidSources.length}/${sources.length} sources match expected title`);
    
    if (allValidSources.length === 0) {
      console.log(`   ❌ NO VALID SOURCES - 2embed returned wrong content!`);
      return { success: false, error: 'Content mismatch - all sources are wrong', wrongContent: true };
    }

    // Step 5: Test first source extraction
    if (sources.length > 0) {
      console.log(`\n[4] Testing stream extraction from first source...`);
      const firstSource = sources[0];
      
      const swpUrl = `https://player4u.xyz${firstSource.url}`;
      const swpResponse = await fetchWithHeaders(swpUrl, player4uUrl);
      const swpHtml = await swpResponse.text();
      
      const iframeMatch = swpHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i);
      if (!iframeMatch) {
        console.log('   ❌ No iframe found');
        return { success: false, error: 'No iframe' };
      }
      
      const iframeId = iframeMatch[1];
      const yesmoviesUrl = `https://yesmovies.baby/e/${iframeId}`;
      
      const yesmoviesResponse = await fetchWithHeaders(yesmoviesUrl, swpUrl);
      const yesmoviesHtml = await yesmoviesResponse.text();
      
      const jwSources = decodeJWPlayer(yesmoviesHtml);
      if (!jwSources) {
        console.log('   ❌ Failed to decode JWPlayer');
        return { success: false, error: 'JWPlayer decode failed' };
      }
      
      const streamUrl = jwSources.hls3 || jwSources.hls2 || jwSources.hls4;
      if (!streamUrl) {
        console.log('   ❌ No stream URL found');
        return { success: false, error: 'No stream URL' };
      }
      
      const finalUrl = streamUrl.startsWith('http') ? streamUrl : `https://yesmovies.baby${streamUrl}`;
      const sourceName = extractSourceName(finalUrl);
      
      console.log(`\n[5] ✅ STREAM EXTRACTED SUCCESSFULLY`);
      console.log(`   Source: ${sourceName}`);
      console.log(`   URL: ${finalUrl.substring(0, 80)}...`);

      // Step 6: Verify stream is accessible
      console.log(`\n[6] Verifying stream accessibility...`);
      try {
        const streamCheck = await fetchWithHeaders(finalUrl, 'https://www.2embed.cc', 8000);
        if (streamCheck.ok) {
          const contentType = streamCheck.headers.get('content-type');
          console.log(`   ✅ Stream accessible! Content-Type: ${contentType}`);
          return { success: true, sourceName, streamUrl: finalUrl, accessible: true };
        } else {
          console.log(`   ⚠️ Stream returned ${streamCheck.status}`);
          return { success: true, sourceName, streamUrl: finalUrl, accessible: false };
        }
      } catch (e) {
        console.log(`   ⚠️ Stream check failed: ${e.message}`);
        return { success: true, sourceName, streamUrl: finalUrl, accessible: false };
      }
    }
    
    return { success: false, error: 'No sources found' };
    
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Main function
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║       2EMBED LIVE TEST - Using TMDB API for Latest Content           ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const results = [];

  // Fetch top 5 trending movies
  console.log('\n\n📽️  FETCHING TOP 5 TRENDING MOVIES...\n');
  const trendingMovies = await fetchTMDB('/trending/movie/week');
  
  for (let i = 0; i < 5; i++) {
    const movie = trendingMovies.results[i];
    const imdbId = await getImdbId(movie.id, 'movie');
    
    if (imdbId) {
      const result = await test2Embed(
        `${movie.title} (${movie.release_date?.substring(0, 4) || 'N/A'})`,
        imdbId,
        movie.id,
        'movie'
      );
      results.push({ name: movie.title, type: 'movie', ...result });
    } else {
      console.log(`\n⚠️ Skipping ${movie.title} - No IMDB ID found`);
      results.push({ name: movie.title, type: 'movie', success: false, error: 'No IMDB ID' });
    }
    
    await new Promise(r => setTimeout(r, 1500));
  }

  // Fetch top 5 trending TV shows
  console.log('\n\n📺  FETCHING TOP 5 TRENDING TV SHOWS...\n');
  const trendingTV = await fetchTMDB('/trending/tv/week');
  
  for (let i = 0; i < 5; i++) {
    const show = trendingTV.results[i];
    const imdbId = await getImdbId(show.id, 'tv');
    const latestEp = await getLatestEpisode(show.id);
    
    if (imdbId) {
      const result = await test2Embed(
        `${show.name} S${latestEp.season}E${latestEp.episode}`,
        imdbId,
        show.id,
        'tv',
        latestEp.season,
        latestEp.episode
      );
      results.push({ name: `${show.name} S${latestEp.season}E${latestEp.episode}`, type: 'tv', ...result });
    } else {
      console.log(`\n⚠️ Skipping ${show.name} - No IMDB ID found`);
      results.push({ name: show.name, type: 'tv', success: false, error: 'No IMDB ID' });
    }
    
    await new Promise(r => setTimeout(r, 1500));
  }

  // Summary
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║                         TEST SUMMARY                                 ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  
  const passed = results.filter(r => r.success).length;
  const accessible = results.filter(r => r.accessible).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`\nTotal: ${results.length} | Extracted: ${passed} | Accessible: ${accessible} | Failed: ${failed}\n`);
  
  console.log('MOVIES:');
  results.filter(r => r.type === 'movie').forEach(r => {
    const status = r.success ? (r.accessible ? '✅' : '⚠️') : '❌';
    const detail = r.success ? `Source: ${r.sourceName}` : `Error: ${r.error}`;
    console.log(`  ${status} ${r.name}: ${detail}`);
  });
  
  console.log('\nTV SHOWS:');
  results.filter(r => r.type === 'tv').forEach(r => {
    const status = r.success ? (r.accessible ? '✅' : '⚠️') : '❌';
    const detail = r.success ? `Source: ${r.sourceName}` : `Error: ${r.error}`;
    console.log(`  ${status} ${r.name}: ${detail}`);
  });

  // Analysis
  console.log('\n\n📊 ANALYSIS:');
  if (passed === results.length && accessible === results.length) {
    console.log('✅ All streams extracted and accessible! 2embed is working correctly.');
  } else if (passed > 0) {
    console.log(`⚠️ ${passed}/${results.length} streams extracted, ${accessible} accessible.`);
    console.log('   2embed extraction works but some streams may be blocked or incorrect.');
  } else {
    console.log('❌ No streams could be extracted. 2embed may be down or has changed.');
  }
}

main().catch(console.error);
