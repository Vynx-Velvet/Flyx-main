/**
 * Test M3U8 segments directly
 */

const REFERER = 'https://cloudnestra.com/';
const MASTER_URL = 'https://tmstr4.shadowlandschronicles.com/pl/H4sIAAAAAAAAAw3KwXaCMBBA0V_KBGmhOynEiBVLAgNkB4k1KsUctIp8fV28zT0vNH7XvRF4pwsPzE8QEiAQwguDLtjT4EPyC5Rx_hTehRq.nnOwDBMjkWe.TmytEjXIE951vZyq1e2oMXXac5Pse2h_e7t9vUVxHneVnTpwtOL5QxAHHbnMFdcPLNNzRw73nCII2owZDWU7WGyB8eKESlLrzCu9Su.G9ViCcds4_Za99XesJHo2ccGWo_AykVeTa.RN7XmUb.vDsypFpgYbix4jdQwhP51JW6y9hiJr64i2n2GUJVe6IWyHycLHUo.bOVrsY4UZLyfFcK34YdLPG6u4O36RKxHQ_zWDoW2tJzOT8B.Zna8xQQEAAA--/master.m3u8';

async function fetchWithReferer(url) {
  return fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': '*/*',
      'Referer': REFERER,
      'Origin': 'https://cloudnestra.com'
    }
  });
}

async function main() {
  console.log('=== M3U8 Segment Analysis ===\n');
  
  // Step 1: Fetch master
  console.log('1. Fetching MASTER playlist...');
  const masterRes = await fetchWithReferer(MASTER_URL);
  console.log('   Status:', masterRes.status);
  
  const master = await masterRes.text();
  console.log('\n   MASTER CONTENT:');
  console.log('   ' + master.split('\n').join('\n   '));
  
  // Step 2: Get variant URL
  const lines = master.split('\n');
  let variantPath = null;
  for (const line of lines) {
    if (line.trim() && !line.startsWith('#')) {
      variantPath = line.trim();
      break;
    }
  }
  
  const base = new URL(MASTER_URL);
  const variantUrl = variantPath.startsWith('/') 
    ? `${base.origin}${variantPath}`
    : `${base.origin}${base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1)}${variantPath}`;
  
  console.log('\n2. Fetching VARIANT playlist...');
  console.log('   URL:', variantUrl);
  
  const variantRes = await fetchWithReferer(variantUrl);
  console.log('   Status:', variantRes.status);
  console.log('   Content-Type:', variantRes.headers.get('content-type'));
  
  const variant = await variantRes.text();
  console.log('\n   VARIANT CONTENT (first 1500 chars):');
  console.log('   ' + variant.substring(0, 1500).split('\n').join('\n   '));
  
  // Step 3: Get first segment
  const segLines = variant.split('\n');
  let segPath = null;
  for (const line of segLines) {
    if (line.trim() && !line.startsWith('#')) {
      segPath = line.trim();
      break;
    }
  }
  
  const variantBase = new URL(variantUrl);
  // CRITICAL: Check if segment URL is already absolute!
  let segUrl;
  if (segPath.startsWith('http://') || segPath.startsWith('https://')) {
    segUrl = segPath; // Already absolute - use as-is
  } else if (segPath.startsWith('/')) {
    segUrl = `${variantBase.origin}${segPath}`;
  } else {
    segUrl = `${variantBase.origin}${variantBase.pathname.substring(0, variantBase.pathname.lastIndexOf('/') + 1)}${segPath}`;
  }
  
  console.log('\n3. Fetching FIRST SEGMENT...');
  console.log('   URL:', segUrl);
  
  const segRes = await fetchWithReferer(segUrl);
  console.log('   Status:', segRes.status);
  console.log('   Content-Type:', segRes.headers.get('content-type'));
  console.log('   Content-Length:', segRes.headers.get('content-length'));
  
  if (segRes.ok) {
    const buf = await segRes.arrayBuffer();
    const bytes = new Uint8Array(buf.slice(0, 20));
    console.log('   First 20 bytes:', Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' '));
    console.log('   Is MPEG-TS (0x47):', bytes[0] === 0x47 ? 'YES' : 'NO');
  }
}

main().catch(console.error);
