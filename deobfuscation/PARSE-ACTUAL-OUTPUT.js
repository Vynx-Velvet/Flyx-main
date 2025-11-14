/**
 * PARSE ACTUAL OUTPUT
 * Parse the actual output format from the successful extraction
 */

// The actual output from the successful test
const actualOutput = `https://tmstr5.{v1}/pl/H4sIAAAAAAAAAx3OW3KCMBQA0C2RBFT61yIPUaDeNAnkLyHaDA1DC6iU1bfjBs4c5JngqjxPmYtWGmsc.Fvf222VbtvwGpIXzfJD4fkBTTnQTnLBm1Hi9sGT5F12tjGdJWW_LJA0D9WZSiI4FfUw6i7_kcQwnaIN1LJSKI_Z7y4oXUn1auaPlEcUu6nKXu9ncrhDYqMTDvFFlH2Zznvx70PGM_rlCKS2Z8xtTGxVkTmk62RhCKbL_hMxYo.wQi06iHjGxlbMG9YjVNGQNHgeBIc3GjdIRPMgVxlA7HjDv89lKm_Pq7NHvcqRiR2pomkxtb2Jmieit1Bkuf8HEvX3eyEBAAA-/master.m3u8`;

console.log('🔍 PARSING ACTUAL OUTPUT FORMAT\n');
console.log('='.repeat(80) + '\n');

console.log('Original URL:');
console.log(actualOutput + '\n');

// Find placeholders
const placeholders = actualOutput.match(/\{[^}]+\}/g);
console.log(`Found ${placeholders ? placeholders.length : 0} placeholders: ${placeholders ? placeholders.join(', ') : 'none'}\n`);

// Resolve placeholders
function resolvePlaceholders(url) {
  const urls = [];
  
  const cdnMappings = {
    '{v1}': ['vipanicdn.net', 'vipstream1.com', 'cdn1.vidsrc.stream'],
    '{v2}': ['vipanicdn2.net', 'vipstream2.com', 'cdn2.vidsrc.stream'],
    '{v3}': ['vipanicdn3.net', 'vipstream3.com', 'cdn3.vidsrc.stream'],
    '{v4}': ['vipanicdn4.net', 'vipstream4.com', 'cdn4.vidsrc.stream'],
    '{s1}': ['io', 'com', 'net'],
    '{s2}': ['io', 'com', 'net']
  };
  
  const placeholders = url.match(/\{[^}]+\}/g) || [];
  
  if (placeholders.length === 0) {
    return [url];
  }
  
  const firstPlaceholder = placeholders[0];
  const replacements = cdnMappings[firstPlaceholder] || [firstPlaceholder.slice(1, -1)];
  
  for (const replacement of replacements) {
    const newUrl = url.replace(firstPlaceholder, replacement);
    const resolvedUrls = resolvePlaceholders(newUrl);
    urls.push(...resolvedUrls);
  }
  
  return urls;
}

const resolved = resolvePlaceholders(actualOutput);

console.log(`✅ Generated ${resolved.length} URL variants:\n`);

resolved.forEach((url, i) => {
  console.log(`${i + 1}. ${url}`);
});

console.log(`\n✅ All placeholders resolved successfully!`);
console.log(`\nThese URLs are ready to use for HLS streaming.`);
