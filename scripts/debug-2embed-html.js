/**
 * Debug script to inspect the actual HTML from 2embed/player4u
 */

async function fetchWithHeaders(url, referer) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Referer': referer || '',
    }
  });
  return response;
}

async function debug() {
  // Test with a known movie - Fight Club
  const imdbId = 'tt0137523';
  const embedUrl = `https://www.2embed.cc/embed/${imdbId}`;
  
  console.log('=== DEBUGGING 2EMBED HTML STRUCTURE ===\n');
  console.log(`Testing: Fight Club (${imdbId})\n`);
  
  // Step 1: Get 2embed page
  console.log('[1] Fetching 2embed page...');
  const embedResponse = await fetchWithHeaders(embedUrl);
  const embedHtml = await embedResponse.text();
  
  // Find all server options
  const serverRegex = /onclick="go\('([^']+)'\)"/g;
  const serverMatches = Array.from(embedHtml.matchAll(serverRegex));
  
  console.log(`\nFound ${serverMatches.length} server options:`);
  serverMatches.forEach((m, i) => {
    console.log(`  [${i + 1}] ${m[1].substring(0, 80)}...`);
  });
  
  // Get player4u URL
  const player4uMatch = serverMatches.find(m => m[1].includes('player4u'));
  if (!player4uMatch) {
    console.log('\n❌ No player4u URL found!');
    return;
  }
  
  const player4uUrl = player4uMatch[1];
  console.log(`\n[2] Fetching player4u page: ${player4uUrl.substring(0, 80)}...`);
  
  const player4uResponse = await fetchWithHeaders(player4uUrl, embedUrl);
  const player4uHtml = await player4uResponse.text();
  
  console.log(`\nPlayer4u HTML length: ${player4uHtml.length} bytes`);
  
  // Look for the dropdown/source list structure
  console.log('\n[3] Analyzing HTML structure...\n');
  
  // Find all go() calls
  const goRegex = /go\('([^']+)'\)/g;
  const goMatches = Array.from(player4uHtml.matchAll(goRegex));
  
  console.log(`Found ${goMatches.length} go() calls\n`);
  
  // Show first 5 URLs
  console.log('First 5 source URLs:');
  for (let i = 0; i < Math.min(5, goMatches.length); i++) {
    const url = goMatches[i][1];
    console.log(`\n[${i + 1}] Full URL: ${url}`);
    
    // Check for tit parameter
    const titMatch = url.match(/tit=([^&]+)/);
    if (titMatch) {
      console.log(`    Title param: ${decodeURIComponent(titMatch[1])}`);
    } else {
      console.log(`    ⚠️ No 'tit' parameter found!`);
    }
    
    // Check for other parameters
    const params = url.split('?')[1]?.split('&') || [];
    console.log(`    Parameters: ${params.join(', ')}`);
  }
  
  // Look for list items with source names
  console.log('\n\n[4] Looking for source names in HTML...\n');
  
  // Try to find <li> elements with source info
  const liRegex = /<li[^>]*>.*?<\/li>/gis;
  const liMatches = Array.from(player4uHtml.matchAll(liRegex));
  
  console.log(`Found ${liMatches.length} <li> elements`);
  
  // Show first 5
  for (let i = 0; i < Math.min(5, liMatches.length); i++) {
    const li = liMatches[i][0];
    // Clean up for display
    const cleaned = li.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    console.log(`  [${i + 1}] ${cleaned.substring(0, 100)}`);
  }
  
  // Look for any text that might be source names
  console.log('\n\n[5] Looking for dropdown/select elements...\n');
  
  const selectRegex = /<select[^>]*>.*?<\/select>/gis;
  const selectMatches = Array.from(player4uHtml.matchAll(selectRegex));
  console.log(`Found ${selectMatches.length} <select> elements`);
  
  const dropdownRegex = /class="[^"]*dropdown[^"]*"/gi;
  const dropdownMatches = Array.from(player4uHtml.matchAll(dropdownRegex));
  console.log(`Found ${dropdownMatches.length} dropdown classes`);
  
  // Save HTML for manual inspection
  const fs = require('fs');
  fs.writeFileSync('debug-player4u.html', player4uHtml);
  console.log('\n✓ Saved player4u HTML to debug-player4u.html for inspection');
  
  // Also check the structure around go() calls
  console.log('\n\n[6] Context around first go() call...\n');
  const firstGoIndex = player4uHtml.indexOf("go('");
  if (firstGoIndex > -1) {
    const context = player4uHtml.substring(Math.max(0, firstGoIndex - 200), firstGoIndex + 300);
    console.log(context);
  }
}

debug().catch(console.error);
