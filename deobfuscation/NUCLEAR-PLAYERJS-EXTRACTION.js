/**
 * NUCLEAR PLAYERJS EXTRACTION
 * 
 * Extract EVERY string, EVERY pattern, EVERY possible CDN reference
 * No stone left unturned
 */

const fs = require('fs');

async function nuclearExtraction() {
  console.log('💣 NUCLEAR EXTRACTION OF PLAYERJS - FINDING ALL CDNS\n');
  console.log('='.repeat(80) + '\n');
  
  try {
    const playerjs = fs.readFileSync('deobfuscation/playerjs.js', 'utf8');
    console.log(`Loaded Playerjs: ${playerjs.length} characters\n`);
    
    // 1. EXTRACT ALL STRINGS (quoted content)
    console.log('1. EXTRACTING ALL QUOTED STRINGS:\n');
    
    const stringPatterns = [
      /"([^"]{3,})"/g,  // Double quoted strings (min 3 chars)
      /'([^']{3,})'/g,  // Single quoted strings (min 3 chars)
    ];
    
    const allStrings = new Set();
    
    stringPatterns.forEach(pattern => {
      const matches = [...playerjs.matchAll(pattern)];
      matches.forEach(match => {
        allStrings.add(match[1]);
      });
    });
    
    console.log(`Found ${allStrings.size} unique strings\n`);
    
    // Filter for domain-like strings
    const domainLikeStrings = [...allStrings].filter(str => {
      return str.includes('.') && 
             (str.includes('com') || str.includes('net') || str.includes('io') || 
              str.includes('org') || str.includes('tv') || str.includes('cc') ||
              str.includes('http') || str.includes('://'));
    });
    
    if (domainLikeStrings.length > 0) {
      console.log('DOMAIN-LIKE STRINGS FOUND:');
      domainLikeStrings.forEach((str, i) => {
        console.log(`${i + 1}. "${str}"`);
      });
      console.log('');
    }
    
    // 2. SEARCH FOR SPECIFIC CDN PATTERNS
    console.log('='.repeat(80));
    console.log('2. SEARCHING FOR SPECIFIC CDN PATTERNS:\n');
    
    const cdnPatterns = [
      /tmstr\d*/gi,
      /app\d+/gi,
      /cdn\d*/gi,
      /stream\d*/gi,
      /media\d*/gi,
      /video\d*/gi,
    ];
    
    cdnPatterns.forEach((pattern, i) => {
      const matches = [...playerjs.matchAll(pattern)];
      if (matches.length > 0) {
        const unique = [...new Set(matches.map(m => m[0]))];
        console.log(`Pattern ${i + 1} (${pattern}): ${unique.join(', ')}`);
      }
    });
    console.log('');
    
    // 3. EXTRACT ALL VARIABLE ASSIGNMENTS
    console.log('='.repeat(80));
    console.log('3. EXTRACTING VARIABLE ASSIGNMENTS WITH STRINGS:\n');
    
    const assignmentPattern = /(\w+)\s*[=:]\s*["']([^"']+)["']/g;
    const assignments = [...playerjs.matchAll(assignmentPattern)];
    
    const relevantAssignments = assignments.filter(match => {
      const value = match[2];
      return value.includes('.') || value.includes('http') || 
             value.includes('v1') || value.includes('v2') || 
             value.includes('v3') || value.includes('v4') ||
             value.includes('{') || value.includes('}');
    });
    
    if (relevantAssignments.length > 0) {
      console.log('RELEVANT VARIABLE ASSIGNMENTS:');
      relevantAssignments.slice(0, 20).forEach((match, i) => {
        console.log(`${i + 1}. ${match[1]} = "${match[2]}"`);
      });
      console.log('');
    }
    
    // 4. SEARCH FOR ARRAY/OBJECT LITERALS WITH DOMAINS
    console.log('='.repeat(80));
    console.log('4. SEARCHING FOR ARRAYS/OBJECTS WITH DOMAINS:\n');
    
    // Look for arrays
    const arrayPattern = /\[([^\]]{20,200})\]/g;
    const arrays = [...playerjs.matchAll(arrayPattern)];
    
    const domainArrays = arrays.filter(match => {
      const content = match[1];
      return (content.match(/["']/g) || []).length >= 2 && 
             (content.includes('.com') || content.includes('.net') || 
              content.includes('.io') || content.includes('.org'));
    });
    
    if (domainArrays.length > 0) {
      console.log('ARRAYS WITH DOMAINS:');
      domainArrays.forEach((match, i) => {
        console.log(`${i + 1}. [${match[1].substring(0, 150)}...]`);
      });
      console.log('');
    }
    
    // 5. LOOK FOR PLACEHOLDER PATTERNS
    console.log('='.repeat(80));
    console.log('5. SEARCHING FOR PLACEHOLDER PATTERNS:\n');
    
    const placeholderPatterns = [
      /\{v\d\}/g,
      /\{s\d\}/g,
      /"v\d"/g,
      /'v\d'/g,
      /v\d\s*[:=]/g,
      /s\d\s*[:=]/g,
    ];
    
    placeholderPatterns.forEach((pattern, i) => {
      const matches = [...playerjs.matchAll(pattern)];
      if (matches.length > 0) {
        console.log(`Pattern ${i + 1} (${pattern}): Found ${matches.length} matches`);
        const unique = [...new Set(matches.map(m => m[0]))];
        console.log(`  Unique: ${unique.join(', ')}`);
        
        // Show context for first match
        if (matches.length > 0) {
          const firstMatch = matches[0];
          const index = firstMatch.index;
          const contextStart = Math.max(0, index - 150);
          const contextEnd = Math.min(playerjs.length, index + 150);
          const context = playerjs.substring(contextStart, contextEnd);
          console.log(`  Context: ...${context.replace(/\n/g, ' ')}...`);
        }
      }
    });
    console.log('');
    
    // 6. SEARCH FOR TLD PATTERNS (.com, .net, .io, .org)
    console.log('='.repeat(80));
    console.log('6. SEARCHING FOR TLD PATTERNS:\n');
    
    const tldPattern = /\.(com|net|io|org|tv|cc|me|co)/gi;
    const tldMatches = [...playerjs.matchAll(tldPattern)];
    
    console.log(`Found ${tldMatches.length} TLD references\n`);
    
    // Get context around each TLD
    const tldContexts = tldMatches.slice(0, 10).map(match => {
      const index = match.index;
      const contextStart = Math.max(0, index - 50);
      const contextEnd = Math.min(playerjs.length, index + 20);
      return playerjs.substring(contextStart, contextEnd);
    });
    
    if (tldContexts.length > 0) {
      console.log('TLD CONTEXTS:');
      tldContexts.forEach((ctx, i) => {
        console.log(`${i + 1}. ...${ctx.replace(/\n/g, ' ')}...`);
      });
      console.log('');
    }
    
    // 7. LOOK FOR SPLIT/REPLACE OPERATIONS
    console.log('='.repeat(80));
    console.log('7. SEARCHING FOR SPLIT/REPLACE OPERATIONS:\n');
    
    const splitPattern = /\.split\s*\(\s*["']([^"']+)["']\s*\)/g;
    const splitMatches = [...playerjs.matchAll(splitPattern)];
    
    if (splitMatches.length > 0) {
      console.log('SPLIT OPERATIONS:');
      splitMatches.forEach((match, i) => {
        console.log(`${i + 1}. split("${match[1]}")`);
        
        // Show context
        const index = match.index;
        const contextStart = Math.max(0, index - 100);
        const contextEnd = Math.min(playerjs.length, index + 100);
        const context = playerjs.substring(contextStart, contextEnd);
        console.log(`   Context: ...${context.replace(/\n/g, ' ')}...`);
      });
      console.log('');
    }
    
    const replacePattern = /\.replace\s*\(\s*([^)]+)\s*\)/g;
    const replaceMatches = [...playerjs.matchAll(replacePattern)];
    
    console.log(`Found ${replaceMatches.length} replace operations\n`);
    
    // Filter for interesting replaces
    const interestingReplaces = replaceMatches.filter(match => {
      const args = match[1];
      return args.includes('{') || args.includes('v') || args.includes('s') ||
             args.includes('.com') || args.includes('.net') || args.includes('.io');
    });
    
    if (interestingReplaces.length > 0) {
      console.log('INTERESTING REPLACE OPERATIONS:');
      interestingReplaces.slice(0, 10).forEach((match, i) => {
        console.log(`${i + 1}. replace(${match[1]})`);
        
        // Show context
        const index = match.index;
        const contextStart = Math.max(0, index - 100);
        const contextEnd = Math.min(playerjs.length, index + 100);
        const context = playerjs.substring(contextStart, contextEnd);
        console.log(`   Context: ...${context.replace(/\n/g, ' ')}...`);
      });
      console.log('');
    }
    
    // 8. EXTRACT ALL FUNCTION DEFINITIONS
    console.log('='.repeat(80));
    console.log('8. SEARCHING FOR FUNCTIONS THAT PROCESS URLS:\n');
    
    const functionPattern = /function\s*\w*\s*\([^)]*\)\s*\{[^}]{0,500}\}/g;
    const functions = [...playerjs.matchAll(functionPattern)];
    
    const urlFunctions = functions.filter(match => {
      const body = match[0];
      return (body.includes('url') || body.includes('file') || body.includes('src')) &&
             (body.includes('replace') || body.includes('split') || body.includes('{'));
    });
    
    if (urlFunctions.length > 0) {
      console.log('URL PROCESSING FUNCTIONS:');
      urlFunctions.slice(0, 5).forEach((match, i) => {
        console.log(`${i + 1}. ${match[0].substring(0, 200)}...`);
      });
      console.log('');
    }
    
    // 9. BRUTE FORCE SEARCH FOR COMMON CDN NAMES
    console.log('='.repeat(80));
    console.log('9. BRUTE FORCE SEARCH FOR COMMON CDN NAMES:\n');
    
    const cdnNames = [
      'tmstr', 'tmstr1', 'tmstr2', 'tmstr3', 'tmstr4', 'tmstr5',
      'app', 'app1', 'app2', 'app3', 'app4',
      'cdn', 'cdn1', 'cdn2', 'cdn3', 'cdn4',
      'stream', 'stream1', 'stream2',
      'media', 'video', 'content',
      'cloudflare', 'fastly', 'akamai',
      'vidsrc', 'embed', 'player'
    ];
    
    cdnNames.forEach(name => {
      const regex = new RegExp(name, 'gi');
      const matches = playerjs.match(regex);
      if (matches && matches.length > 0 && matches.length < 50) {
        console.log(`"${name}": ${matches.length} occurrences`);
        
        // Find one context
        const index = playerjs.indexOf(name);
        if (index !== -1) {
          const contextStart = Math.max(0, index - 80);
          const contextEnd = Math.min(playerjs.length, index + 80);
          const context = playerjs.substring(contextStart, contextEnd);
          console.log(`  Context: ...${context.replace(/\n/g, ' ')}...`);
        }
      }
    });
    console.log('');
    
    // 10. LOOK FOR BASE64 OR ENCODED STRINGS
    console.log('='.repeat(80));
    console.log('10. SEARCHING FOR ENCODED STRINGS:\n');
    
    const base64Pattern = /["']([A-Za-z0-9+/]{20,}={0,2})["']/g;
    const base64Matches = [...playerjs.matchAll(base64Pattern)];
    
    if (base64Matches.length > 0) {
      console.log(`Found ${base64Matches.length} potential base64 strings`);
      
      // Try to decode first few
      base64Matches.slice(0, 5).forEach((match, i) => {
        try {
          const decoded = Buffer.from(match[1], 'base64').toString('utf8');
          if (decoded.includes('.') || decoded.includes('http')) {
            console.log(`${i + 1}. Decoded: "${decoded}"`);
          }
        } catch (e) {
          // Not valid base64
        }
      });
      console.log('');
    }
    
    // 11. FINAL COMPREHENSIVE STRING DUMP
    console.log('='.repeat(80));
    console.log('11. ALL STRINGS CONTAINING DOTS (potential domains):\n');
    
    const dotStrings = [...allStrings].filter(str => {
      return str.includes('.') && str.length > 3 && str.length < 100;
    });
    
    if (dotStrings.length > 0) {
      console.log(`Found ${dotStrings.length} strings with dots:\n`);
      dotStrings.slice(0, 50).forEach((str, i) => {
        console.log(`${i + 1}. "${str}"`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('NUCLEAR EXTRACTION COMPLETE');
    console.log('='.repeat(80) + '\n');
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    console.log(error.stack);
  }
}

nuclearExtraction();
