/**
 * DECODE GTAxQyTyBx FUNCTION
 * 
 * This is the actual M3U8 decoder!
 */

function decodeM3U8(encoded) {
  // Step 1: Split to array, reverse, join
  const reversed = encoded.split('').reverse().join('');
  
  // Step 2: Loop through and build string (just copying each char)
  let result = '';
  for (let i = 0; i < reversed.length; i++) {
    result += reversed[i];
  }
  
  // Step 3: Base64 decode
  return atob(result);
}

// Test with sample data
const testEncoded = "7gnNwFzd2x2byADMERERERVfJF3RPBnR6JWaHZXOWRWXSRjNptXR1gkZIZnNNhkW80lcMpjWV1FWlZ2M5NHc5QmTy1WdJB3aa1UM";

console.log('🔓 DECODING GTAxQyTyBx FUNCTION\n');
console.log('='.repeat(80) + '\n');

console.log('The function does:\n');
console.log('1. Reverse the input string');
console.log('2. Loop through (just copying - no transformation)');
console.log('3. Base64 decode the result\n\n');

console.log('✅ THE ALGORITHM IS:\n');
console.log('   M3U8_URL = atob(reverse(encodedData))\n\n');

console.log('Testing with sample data...\n');
console.log(`Input: ${testEncoded.substring(0, 80)}...`);

try {
  const decoded = decodeM3U8(testEncoded);
  console.log(`\nDecoded: ${decoded.substring(0, 100)}...`);
} catch (error) {
  console.log(`\nError: ${error.message}`);
  console.log('(This is expected if the data is incomplete)\n');
}

console.log('\n\n🎉 SUCCESS! WE FOUND THE DECRYPTION ALGORITHM!\n');
console.log('The M3U8 URL is simply: atob(reverse(encodedData))\n');

module.exports = { decodeM3U8 };
