/**
 * Test the stream proxy's M3U8 rewriting with absolute segment URLs
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

async function main() {
  console.log('=== Testing Proxy M3U8 Rewriting ===\n');
  
  // Fetch the variant playlist (which has absolute segment URLs)
  const variantUrl = 'https://tmstr4.shadowlandschronicles.com/pl/H4sIAAAAAAAAAw3KwXaCMBBA0V_KBGmhOynEiBVLAgNkB4k1KsUctIp8fV28zT0vNH7XvRF4pwsPzE8QEiAQwguDLtjT4EPyC5Rx_hTehRq.nnOwDBMjkWe.TmytEjXIE951vZyq1e2oMXXac5Pse2h_e7t9vUVxHneVnTpwtOL5QxAHHbnMFdcPLNNzRw73nCII2owZDWU7WGyB8eKESlLrzCu9Su.G9ViCcds4_Za99XesJHo2ccGWo_AykVeTa.RN7XmUb.vDsypFpgYbix4jdQwhP51JW6y9hiJr64i2n2GUJVe6IWyHycLHUo.bOVrsY4UZLyfFcK34YdLPG6u4O36RKxHQ_zWDoW2tJzOT8B.Zna8xQQEAAA--/7a67bab9038b6ca38d13b08cead24c49/index.m3u8';
  
  const res = await fetch(variantUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': REFERER,
    }
  });
  
  const playlist = await res.text();
  console.log('Original playlist (first 10 lines):');
  console.log(playlist.split('\n').slice(0, 10).join('\n'));
  
  console.log('\n--- Rewriting with proxy ---\n');
  
  const rewritten = rewritePlaylistUrls(playlist, variantUrl, 'vidsrc', REFERER);
  console.log('Rewritten playlist (first 10 lines):');
  console.log(rewritten.split('\n').slice(0, 10).join('\n'));
  
  // Extract first segment URL from rewritten playlist
  const segmentLine = rewritten.split('\n').find(l => l.includes('/api/stream-proxy') && l.includes('apogeeofabstraction'));
  if (segmentLine) {
    console.log('\n✓ Segment URL correctly rewritten to use proxy!');
    console.log('  Sample:', segmentLine.substring(0, 150) + '...');
    
    // Decode the URL parameter to verify
    const urlParam = new URL('http://localhost' + segmentLine).searchParams.get('url');
    console.log('  Decoded segment URL:', urlParam);
  } else {
    console.log('\n✗ ERROR: Segment URLs not properly rewritten!');
  }
}

main().catch(console.error);
