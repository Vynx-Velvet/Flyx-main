/**
 * Test the local proxy endpoint
 */

const VARIANT_URL = 'https://tmstr4.shadowlandschronicles.com/pl/H4sIAAAAAAAAAw3KwXaCMBBA0V_KBGmhOynEiBVLAgNkB4k1KsUctIp8fV28zT0vNH7XvRF4pwsPzE8QEiAQwguDLtjT4EPyC5Rx_hTehRq.nnOwDBMjkWe.TmytEjXIE951vZyq1e2oMXXac5Pse2h_e7t9vUVxHneVnTpwtOL5QxAHHbnMFdcPLNNzRw73nCII2owZDWU7WGyB8eKESlLrzCu9Su.G9ViCcds4_Za99XesJHo2ccGWo_AykVeTa.RN7XmUb.vDsypFpgYbix4jdQwhP51JW6y9hiJr64i2n2GUJVe6IWyHycLHUo.bOVrsY4UZLyfFcK34YdLPG6u4O36RKxHQ_zWDoW2tJzOT8B.Zna8xQQEAAA--/7a67bab9038b6ca38d13b08cead24c49/index.m3u8';
const REFERER = 'https://cloudnestra.com/';

async function main() {
  console.log('=== Testing Local Proxy ===\n');
  
  // Test 1: Fetch variant playlist through proxy
  console.log('1. Fetching VARIANT playlist through proxy...');
  const proxyUrl = `http://localhost:3000/api/stream-proxy?url=${encodeURIComponent(VARIANT_URL)}&source=vidsrc&referer=${encodeURIComponent(REFERER)}`;
  
  const res = await fetch(proxyUrl);
  console.log('   Status:', res.status);
  console.log('   Content-Type:', res.headers.get('content-type'));
  
  const content = await res.text();
  console.log('\n   First 10 lines of rewritten playlist:');
  content.split('\n').slice(0, 10).forEach(line => {
    console.log('   ' + line.substring(0, 120) + (line.length > 120 ? '...' : ''));
  });
  
  // Check if segment URLs are properly rewritten
  const hasProxiedSegments = content.includes('/api/stream-proxy') && content.includes('apogeeofabstraction');
  console.log('\n   Segments proxied:', hasProxiedSegments ? 'YES ✓' : 'NO ✗');
  
  if (!hasProxiedSegments) {
    console.log('\n   ERROR: Segment URLs not rewritten!');
    return;
  }
  
  // Test 2: Fetch a segment through proxy
  console.log('\n2. Fetching SEGMENT through proxy...');
  const segmentLine = content.split('\n').find(l => l.includes('/api/stream-proxy') && l.includes('apogeeofabstraction'));
  if (!segmentLine) {
    console.log('   ERROR: No segment URL found');
    return;
  }
  
  const segmentProxyUrl = 'http://localhost:3000' + segmentLine.trim();
  console.log('   Segment proxy URL (truncated):', segmentProxyUrl.substring(0, 100) + '...');
  
  const segRes = await fetch(segmentProxyUrl);
  console.log('   Status:', segRes.status);
  console.log('   Content-Type:', segRes.headers.get('content-type'));
  
  if (segRes.ok) {
    const buf = await segRes.arrayBuffer();
    const bytes = new Uint8Array(buf.slice(0, 4));
    console.log('   Size:', buf.byteLength, 'bytes');
    console.log('   First 4 bytes:', Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' '));
    console.log('   Is MPEG-TS (0x47):', bytes[0] === 0x47 ? 'YES ✓' : 'NO ✗');
    
    if (bytes[0] === 0x47 && segRes.headers.get('content-type') === 'video/mp2t') {
      console.log('\n=== SUCCESS ===');
      console.log('The proxy correctly:');
      console.log('  1. Rewrites playlist URLs to go through proxy');
      console.log('  2. Detects video data disguised as .html');
      console.log('  3. Returns correct content-type (video/mp2t)');
      console.log('\nHLS.js should now be able to play the stream!');
    }
  }
}

main().catch(console.error);
