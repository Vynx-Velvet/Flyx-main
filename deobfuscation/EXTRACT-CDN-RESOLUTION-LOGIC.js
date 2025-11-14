/**
 * EXTRACT CDN RESOLUTION LOGIC
 * 
 * Based on the nuclear extraction, we found:
 * - Pattern 3: "v9", "v2" in quotes
 * - Pattern 5: v4:, v2:, v3:, v7:, v5=, v2=, v3=, v8=, v4=, v0=, v1: assignments
 * - Pattern 6: s2=, s0=, s6=, s8=, s3=, s1=, s9=, s7=, s8: assignments
 * 
 * Let's find the actual resolution code
 */

const fs = require('fs');

async function extractCDNResolution() {
  console.log('🎯 EXTRACTING CDN RESOLUTION LOGIC\n');
  console.log('='.repeat(80) + '\n');
  
  try {
    const playerjs = fs.readFileSync('deobfuscation/playerjs.js', 'utf8');
    
    // 1. Find the v1, v2, v3, v4 object/array definition
    console.log('1. SEARCHING FOR v1/v2/v3/v4 OBJECT DEFINITION:\n');
    
    // Look for patterns like: {v1:"...", v2:"...", v3:"...", v4:"..."}
    // or: v1:"...", v2:"...", v3:"...", v4:"..."
    const v1234Pattern = /[{,]\s*v1\s*[:=]\s*["']([^"']+)["'][^}]*v2\s*[:=]\s*["']([^"']+)["'][^}]*v3\s*[:=]\s*["']([^"']+)["'][^}]*v4\s*[:=]\s*["']([^"']+)["']/g;
    const v1234Matches = [...playerjs.matchAll(v1234Pattern)];
    
    if (v1234Matches.length > 0) {
      console.log('FOUND v1/v2/v3/v4 DEFINITIONS:');
      v1234Matches.forEach((match, i) => {
        console.log(`\n${i + 1}. v1="${match[1]}", v2="${match[2]}", v3="${match[3]}", v4="${match[4]}"`);
        
        // Show context
        const index = match.index;
        const contextStart = Math.max(0, index - 300);
        const contextEnd = Math.min(playerjs.length, index + 300);
        const context = playerjs.substring(contextStart, contextEnd);
        console.log(`   Context: ${context.replace(/\n/g, ' ')}`);
      });
    } else {
      console.log('No v1/v2/v3/v4 object found in that pattern');
    }
    
    // 2. Look for individual v1, v2, v3, v4 assignments
    console.log('\n' + '='.repeat(80));
    console.log('2. SEARCHING FOR INDIVIDUAL v ASSIGNMENTS:\n');
    
    const vAssignments = {};
    for (let i = 0; i <= 9; i++) {
      const pattern = new RegExp(`v${i}\\s*[:=]\\s*["']([^"']+)["']`, 'g');
      const matches = [...playerjs.matchAll(pattern)];
      
      if (matches.length > 0) {
        vAssignments[`v${i}`] = matches.map(m => m[1]);
        console.log(`v${i}: ${matches.length} assignments`);
        matches.slice(0, 3).forEach((match, j) => {
          console.log(`  ${j + 1}. "${match[1]}"`);
        });
      }
    }
    
    // 3. Look for s1, s2, s3, s4 assignments (alternative pattern)
    console.log('\n' + '='.repeat(80));
    console.log('3. SEARCHING FOR s ASSIGNMENTS:\n');
    
    const sAssignments = {};
    for (let i = 0; i <= 9; i++) {
      const pattern = new RegExp(`s${i}\\s*[:=]\\s*["']([^"']+)["']`, 'g');
      const matches = [...playerjs.matchAll(pattern)];
      
      if (matches.length > 0) {
        sAssignments[`s${i}`] = matches.map(m => m[1]);
        console.log(`s${i}: ${matches.length} assignments`);
        matches.slice(0, 3).forEach((match, j) => {
          console.log(`  ${j + 1}. "${match[1]}"`);
        });
      }
    }
    
    // 4. Look for replace operations with {v1}, {v2}, etc.
    console.log('\n' + '='.repeat(80));
    console.log('4. SEARCHING FOR REPLACE OPERATIONS WITH PLACEHOLDERS:\n');
    
    const replaceWithPlaceholder = /\.replace\s*\(\s*[^,]+,\s*([^)]+)\)/g;
    const replaceMatches = [...playerjs.matchAll(replaceWithPlaceholder)];
    
    const relevantReplaces = replaceMatches.filter(match => {
      const replacement = match[1];
      return replacement.includes('v1') || replacement.includes('v2') || 
             replacement.includes('v3') || replacement.includes('v4') ||
             replacement.includes('{') || replacement.includes('}');
    });
    
    if (relevantReplaces.length > 0) {
      console.log('FOUND REPLACE OPERATIONS WITH PLACEHOLDERS:');
      relevantReplaces.slice(0, 10).forEach((match, i) => {
        console.log(`\n${i + 1}. ${match[0]}`);
        
        const index = match.index;
        const contextStart = Math.max(0, index - 200);
        const contextEnd = Math.min(playerjs.length, index + 200);
        const context = playerjs.substring(contextStart, contextEnd);
        console.log(`   Context: ${context.replace(/\n/g, ' ')}`);
      });
    }
    
    // 5. Look for functions that might resolve placeholders
    console.log('\n' + '='.repeat(80));
    console.log('5. SEARCHING FOR PLACEHOLDER RESOLVER FUNCTIONS:\n');
    
    // Look for functions that take a string and return a modified string
    const resolverPattern = /function\s+(\w+)\s*\([^)]*\)\s*\{[^}]{50,500}(v1|v2|v3|v4|\{v|\{s)[^}]{0,500}\}/g;
    const resolverMatches = [...playerjs.matchAll(resolverPattern)];
    
    if (resolverMatches.length > 0) {
      console.log('FOUND POTENTIAL RESOLVER FUNCTIONS:');
      resolverMatches.slice(0, 5).forEach((match, i) => {
        console.log(`\n${i + 1}. Function: ${match[1]}`);
        console.log(`   Body: ${match[0].substring(0, 300)}...`);
      });
    }
    
    // 6. Look for the actual CDN domains
    console.log('\n' + '='.repeat(80));
    console.log('6. SEARCHING FOR ACTUAL CDN DOMAINS:\n');
    
    // Common CDN patterns
    const cdnDomains = [
      /tmstr\d*\.(com|net|io|org)/gi,
      /app\d*\.(com|net|io|org)/gi,
      /cdn\d*\.(com|net|io|org)/gi,
      /stream\d*\.(com|net|io|org)/gi,
    ];
    
    const foundDomains = new Set();
    
    cdnDomains.forEach(pattern => {
      const matches = [...playerjs.matchAll(pattern)];
      matches.forEach(match => {
        foundDomains.add(match[0]);
      });
    });
    
    if (foundDomains.size > 0) {
      console.log('FOUND CDN DOMAINS:');
      [...foundDomains].forEach((domain, i) => {
        console.log(`${i + 1}. ${domain}`);
        
        // Find context
        const index = playerjs.indexOf(domain);
        if (index !== -1) {
          const contextStart = Math.max(0, index - 150);
          const contextEnd = Math.min(playerjs.length, index + 150);
          const context = playerjs.substring(contextStart, contextEnd);
          console.log(`   Context: ...${context.replace(/\n/g, ' ')}...`);
        }
      });
    } else {
      console.log('No CDN domains found in expected patterns');
    }
    
    // 7. Summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY:\n');
    
    console.log('v Assignments found:', Object.keys(vAssignments).length);
    Object.keys(vAssignments).forEach(key => {
      console.log(`  ${key}: ${vAssignments[key].length} values`);
    });
    
    console.log('\ns Assignments found:', Object.keys(sAssignments).length);
    Object.keys(sAssignments).forEach(key => {
      console.log(`  ${key}: ${sAssignments[key].length} values`);
    });
    
    console.log('\nCDN Domains found:', foundDomains.size);
    
    console.log('\n' + '='.repeat(80));
    console.log('EXTRACTION COMPLETE');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    console.log(error.stack);
  }
}

extractCDNResolution();
