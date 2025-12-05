/**
 * Full end-to-end test of the proxy flow
 * Simulates what HLS.js would do
 */

const MASTER_URL = 'https://tmstr4.shadowlandschronicles.com/pl/H4sIAAAAAAAAAw3KwXaCMBBA0V_KBGmhOynEiBVLAgNkB4k1KsUctIp8fV28zT0vNH7XvRF4pwsPzE8QEiAQwguDLtjT4EPyC5Rx_hTehRq.nnOwDBMjkWe.TmytEjXIE951vZyq1e2oMXXac5Pse2h_e7t9vUVxHneVnTpwtOL5QxAHHbnMFdcPLNNzRw73nCII2owZDWU7WGyB8eKESlLrzCu9Su.G9ViCcds4_Za99XesJHo2ccGWo_AykVeTa.RN7XmUb.vDsypFpgYbix4jdQwhP51JW6y9hiJr64i2n2GUJVe6IWyHycLHUo.bOVrsY4UZLyfFcK34YdLPG6u4O36RKxHQ_zWDoW2tJzOT8B.Zna8xQQEAAA--/master.m3u8';
const REFERER = 'https://cloudnestra.com/';

// Simulate the proxy's rewritePlaylistUrls function
function rewritePlaylistUrls(playlist, baseUrl, source, referer) {
  const lines = playlist.split('\n');
  const rewritten = [];
  
  const base = new URL(baseUrl);
  const basePath = base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);
  
  const proxyUrl = (url) => {
    let absoluteUrl;
    
    if (url.startsWith('http://') || url.startsWith('https://')) {
      absoluteUrl = url;
    } else if (url.startsWith('/')) {
      absoluteUrl = `${base.origin}${url}`;
    } else {
      absoluteUrl = `${base.origin}${basePath}${url}`;
    }
    
    return `/api/stream-proxy?url=${encodeURIComponent(absoluteUrl)}&source=${source}&referer=${encodeURIComponent(referer)}`;
  };
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (line.startsWith('#EXT-X-MEDIA:') || line.startsWith('#EXT-X-I-FRAME-STREAM-INF:')) {
      const uriMatch = line.match(/URI="([^"]+)"/);
      if (uriMatch) {
        const originalUri = uriMatch[1];
        const proxiedUri = proxyUrl(originalUri);
        rewritten.push(line.replace(`URI="${originalUri}"`, `URI="${proxiedUri}"`));
      } else {
        rewritten.push(line);
      }
      continue;
    }
    
    if (line.startsWith('#') || trimmedLine === '') {
      rewritten.push(line);
      continue;
    }

    if (!trimmedLine) {
      rewritten.push(line);
      continue;
    }
    
    try {
      rewritten.push(proxyUrl(trimmedLine));
    } catch (error) {
      rewritten.push(line);
    }
  }

  return rewritten.join('\n');
}

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
  console.log('=== Full Proxy Flow Test ===\n');
  
  // Step 1: Fetch master playlist (simulating proxy)
  console.log('Step 1: Fetching MASTER playlist...');
  const masterRes = await fetchWithReferer(MASTER_URL);
  if (!masterRes.ok) {
    console.log('✗ Master fetch failed:', masterRes.status);
    return;
  }
  const masterPlaylist = await masterRes.text();
  console.log('✓ Master fetched, status:', masterRes.status);
  
  // Rewrite master
  const rewrittenMaster = rewritePlaylistUrls(masterPlaylist, MASTER_URL, 'vidsrc', REFERER);
  
  // Extract first variant URL from rewritten master
  const variantProxyUrl = rewrittenMaster.split('\n').find(l => l.includes('/api/stream-proxy'));
  if (!variantProxyUrl) {
    console.log('✗ No variant URL found in rewritten master');
    return;
  }
  
  // Decode the actual variant URL
  const variantUrl = decodeURIComponent(new URL('http://localhost' + variantProxyUrl).searchParams.get('url'));
  console.log('✓ Variant URL:', variantUrl.substring(0, 80) + '...');
  
  // Step 2: Fetch variant playlist (simulating proxy)
  console.log('\nStep 2: Fetching VARIANT playlist...');
  const variantRes = await fetchWithReferer(variantUrl);
  if (!variantRes.ok) {
    console.log('✗ Variant fetch failed:', variantRes.status);
    return;
  }
  const variantPlaylist = await variantRes.text();
  console.log('✓ Variant fetched, status:', variantRes.status);
  
  // Rewrite variant
  const rewrittenVariant = rewritePlaylistUrls(variantPlaylist, variantUrl, 'vidsrc', REFERER);
  
  // Extract first segment URL from rewritten variant
  const segmentProxyUrl = rewrittenVariant.split('\n').find(l => l.includes('/api/stream-proxy') && l.includes('apogeeofabstraction'));
  if (!segmentProxyUrl) {
    console.log('✗ No segment URL found in rewritten variant');
    console.log('Rewritten variant (first 500 chars):');
    console.log(rewrittenVariant.substring(0, 500));
    return;
  }
  
  // Decode the actual segment URL
  const segmentUrl = decodeURIComponent(new URL('http://localhost' + segmentProxyUrl).searchParams.get('url'));
  console.log('✓ Segment URL:', segmentUrl);
  
  // Step 3: Fetch segment (simulating proxy)
  console.log('\nStep 3: Fetching SEGMENT...');
  const segmentRes = await fetchWithReferer(segmentUrl);
  if (!segmentRes.ok) {
    console.log('✗ Segment fetch failed:', segmentRes.status);
    return;
  }
  
  const segmentData = await segmentRes.arrayBuffer();
  const bytes = new Uint8Array(segmentData.slice(0, 4));
  const isMpegTs = bytes[0] === 0x47;
  
  console.log('✓ Segment fetched!');
  console.log('  Status:', segmentRes.status);
  console.log('  Size:', segmentData.byteLength, 'bytes');
  console.log('  Content-Type:', segmentRes.headers.get('content-type'));
  console.log('  First 4 bytes:', Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' '));
  console.log('  Is MPEG-TS:', isMpegTs ? 'YES ✓' : 'NO ✗');
  
  console.log('\n=== RESULT ===');
  if (isMpegTs) {
    console.log('✓ SUCCESS! The full proxy flow works correctly.');
    console.log('  - Master playlist: ✓');
    console.log('  - Variant playlist: ✓');
    console.log('  - Segment data: ✓ (valid MPEG-TS)');
    console.log('\nThe issue is likely in the browser/HLS.js configuration, not the proxy logic.');
  } else {
    console.log('✗ FAILED! Segment data is not valid MPEG-TS.');
  }
}

main().catch(console.error);
