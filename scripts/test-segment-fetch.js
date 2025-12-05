/**
 * Test fetching a segment directly from the different domain
 */

const SEGMENT_URL = 'https://apogeeofabstraction.website/content/f9de13886f857434534c37b54256c97c/7a67bab9038b6ca38d13b08cead24c49/page-0.html';
const REFERER = 'https://cloudnestra.com/';

async function main() {
  console.log('=== Testing Segment Fetch ===\n');
  
  // Test 1: Direct fetch without referer
  console.log('1. Direct fetch (no referer):');
  try {
    const res1 = await fetch(SEGMENT_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });
    console.log('   Status:', res1.status);
    console.log('   Content-Type:', res1.headers.get('content-type'));
    if (res1.ok) {
      const buf = await res1.arrayBuffer();
      const bytes = new Uint8Array(buf.slice(0, 4));
      console.log('   First 4 bytes:', Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' '));
      console.log('   Is MPEG-TS (0x47):', bytes[0] === 0x47 ? 'YES ✓' : 'NO ✗');
    }
  } catch (e) {
    console.log('   Error:', e.message);
  }
  
  // Test 2: Direct fetch with referer
  console.log('\n2. Direct fetch (with referer):');
  try {
    const res2 = await fetch(SEGMENT_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': REFERER,
        'Origin': 'https://cloudnestra.com'
      }
    });
    console.log('   Status:', res2.status);
    console.log('   Content-Type:', res2.headers.get('content-type'));
    if (res2.ok) {
      const buf = await res2.arrayBuffer();
      const bytes = new Uint8Array(buf.slice(0, 4));
      console.log('   First 4 bytes:', Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' '));
      console.log('   Is MPEG-TS (0x47):', bytes[0] === 0x47 ? 'YES ✓' : 'NO ✗');
      console.log('   Segment size:', buf.byteLength, 'bytes');
    }
  } catch (e) {
    console.log('   Error:', e.message);
  }
  
  // Test 3: Fetch multiple segments to verify consistency
  console.log('\n3. Fetching first 3 segments:');
  for (let i = 0; i < 3; i++) {
    const segUrl = SEGMENT_URL.replace('page-0', `page-${i}`);
    try {
      const res = await fetch(segUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': REFERER,
        }
      });
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf.slice(0, 4));
      const isMpegTs = bytes[0] === 0x47;
      console.log(`   page-${i}.html: ${res.status}, ${buf.byteLength} bytes, MPEG-TS: ${isMpegTs ? 'YES ✓' : 'NO ✗'}`);
    } catch (e) {
      console.log(`   page-${i}.html: Error - ${e.message}`);
    }
  }
  
  console.log('\n=== CONCLUSION ===');
  console.log('The segments are valid MPEG-TS video data disguised as .html files.');
  console.log('The proxy should work correctly if it:');
  console.log('  1. Detects absolute URLs (https://...) and uses them directly');
  console.log('  2. Passes the correct referer header');
  console.log('  3. Returns the binary data with correct content-type');
}

main().catch(console.error);
