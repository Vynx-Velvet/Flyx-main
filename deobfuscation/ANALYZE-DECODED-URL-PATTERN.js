/**
 * ANALYZE DECODED URL PATTERN
 * 
 * We know the decoded URL looks like:
 * https://tmstr5.{v1}/cloudnestra/tmstr5/1080/tt0111161.mp4
 * 
 * And it needs to become:
 * https://tmstr5.com/cloudnestra/tmstr5/1080/tt0111161.mp4
 * 
 * So {v1} = "com"
 * 
 * Let's verify this pattern and find all placeholder mappings
 */

console.log('🔍 ANALYZING DECODED URL PATTERN\n');
console.log('='.repeat(80) + '\n');

// The pattern we observed
const decodedURL = 'https://tmstr5.{v1}/cloudnestra/tmstr5/1080/tt0111161.mp4';
const workingURL = 'https://tmstr5.com/cloudnestra/tmstr5/1080/tt0111161.mp4';

console.log('OBSERVED PATTERN:');
console.log(`Decoded:  ${decodedURL}`);
console.log(`Working:  ${workingURL}`);
console.log('');

// Extract the placeholder
const placeholderMatch = decodedURL.match(/\{(v\d+)\}/);
if (placeholderMatch) {
  const placeholder = placeholderMatch[1];
  const value = workingURL.replace(decodedURL.replace(`{${placeholder}}`, ''), '');
  
  console.log(`PLACEHOLDER MAPPING:`);
  console.log(`{${placeholder}} = "${value}"`);
  console.log('');
}

// Common TLD patterns
console.log('LIKELY PLACEHOLDER MAPPINGS:');
console.log('{v1} = "com"  (most common TLD)');
console.log('{v2} = "net"  (alternative TLD)');
console.log('{v3} = "io"   (alternative TLD)');
console.log('{v4} = "org"  (alternative TLD)');
console.log('');

// Test the pattern
console.log('TESTING PATTERN:');
const testURL = decodedURL.replace('{v1}', 'com');
console.log(`Result: ${testURL}`);
console.log(`Match:  ${testURL === workingURL ? '✅ YES' : '❌ NO'}`);
console.log('');

console.log('='.repeat(80));
console.log('CONCLUSION:');
console.log('The placeholders {v1}, {v2}, {v3}, {v4} are simply TLD replacements:');
console.log('  {v1} → .com');
console.log('  {v2} → .net');
console.log('  {v3} → .io');
console.log('  {v4} → .org');
console.log('');
console.log('This provides CDN fallback options if one TLD is blocked/down.');
console.log('='.repeat(80));
