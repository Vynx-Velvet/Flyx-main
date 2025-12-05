/**
 * Deep analysis of VidSrc M3U8 structure and segments
 */

const REFERER = 'https://cloudnestra.com/';

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
  // Get a fresh VidSrc URL for a recent movie (Venom: The Last Dance)
  const tmdbId = '912649';
  
  console.log('=== VidSrc M3U8 Deep Analysis ===\n');
  console.log('Testing with Venom: The Last Dance (TMDB:', tmdbId, ')\n');
  
  // First, extract the stream URL
  console.log('Step 1: Extracting stream URL...');
  
  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${tmdbId}`;
  const embedResponse = await fetchWithReferer(embedUrl);
  const embedHtml = await embedResponse.text();
  
  const iframeMatch = embedHtml.match(/<iframe[^>]*src=["']([^"']+cloudnestra\.com\/rcp\/([^"']+))["']/i);
  if (!iframeMatch) {
    console.log('ERROR: No iframe found');
    return;
  }
  
  const rcpUrl = `https://cloudnestra.com/rcp/${iframeMatch[2]}`;
  const rcpResponse = await fetchWithReferer(rcpUrl);
  const rcpHtml = await rcpResponse.text();
  
  const prorcpMatch = rcpHtml.match(/src:\s*['"]\/prorcp\/([^'"]+)['"]/);
  if (!prorcpMatch) {
    console.log('ERROR: No prorcp found');
    return;
  }
  
  const prorcpUrl = `https://cloudnestra.com/prorcp/${prorcpMatch[1]}`;
  const prorcpResponse = await fetchWithReferer(prorcpUrl);
  const prorcpHtml = await prorcpResponse.text();
  
  const divMatch = prorcpHtml.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
  const scriptMatch = prorcpHtml.match(/sV05kUlNvOdOxvtC\/([a-f0-9]+)\.js/);
  
  if (!divMatch || !scriptMatch) {
    console.log('ERROR: Missing div or script');
    return;
  }
  
  const scriptUrl = `https://cloudnestra.com/sV05kUlNvOdOxvtC/${scriptMatch[1]}.js`;
  const scriptResponse = await fetchWithReferer(scriptUrl);
  const decoderScript = await scriptResponse.text();
  
  // Execute decoder
  let decodedContent = null;
  const mockWindow = {};
  const windowProxy = new Proxy(mockWindow, {
    set: (target, prop, value) => {
      target[prop] = value;
      if (typeof value === 'string' && value.includes('https://')) {
        decodedContent = value;
      }
      return true;
    },
    get: (target, prop) => target[prop]
  });
  
  const mockDocument = {
    getElementById: (id) => id === divMatch[1] ? { innerHTML: divMatch[2] } : null
  };
  
  const customAtob = (str) => Buffer.from(str, 'base64').toString('binary');
  const customBtoa = (str) => Buffer.from(str, 'binary').toString('base64');
  
  const wrappedCode = `return (function(window, document, atob, btoa, setTimeout, setInterval, console) { "use strict"; ${decoderScript} });`;
  const createRunner = new Function(wrappedCode);
  const runner = createRunner();
  runner(windowProxy, mockDocument, customAtob, customBtoa, (fn) => fn && fn(), () => {}, { log: () => {}, error: () => {}, warn: () => {} });
  
  if (!decodedContent) {
    console.log('ERROR: Decoder failed');
    return;
  }
  
  // Extract first m3u8 URL
  const urls = decodedContent.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/g) || [];
  const streamUrl = urls[0]?.replace(/\{v\d+\}/g, 'shadowlandschronicles.com');
  
  if (!streamUrl) {
    console.log('ERROR: No stream URL found');
    return;
  }
  
  console.log('Stream URL:', streamUrl.substring(0, 80) + '...\n');
  
  // Step 2: Fetch master playlist
  console.log('Step 2: Fetching MASTER playlist...');
  const masterResponse = await fetchWithReferer(streamUrl);
  console.log('  Status:', masterResponse.status);
  
  if (!masterResponse.ok) {
    console.log('  ERROR: Failed to fetch master playlist');
    return;
  }
  
  const masterPlaylist = await masterResponse.text();
  console.log('  Content-Type:', masterResponse.headers.get('content-type'));
  console.log('  Length:', masterPlaylist.length);
  console.log('\n  === MASTER PLAYLIST CONTENT ===');
  console.log(masterPlaylist);
  console.log('  === END MASTER PLAYLIST ===\n');
  
  // Step 3: Parse and fetch variant playlist
  const lines = masterPlaylist.split('\n');
  let variantUrl = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line && !line.startsWith('#')) {
      // This is a URL line
      if (line.startsWith('http')) {
        variantUrl = line;
      } else if (line.startsWith('/')) {
        const base = new URL(streamUrl);
        variantUrl = `${base.origin}${line}`;
      } else {
        const base = new URL(streamUrl);
        const basePath = base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);
        variantUrl = `${base.origin}${basePath}${line}`;
      }
      break;
    }
  }
  
  if (!variantUrl) {
    console.log('ERROR: No variant URL found in master playlist');
    return;
  }
  
  console.log('Step 3: Fetching VARIANT playlist...');
  console.log('  URL:', variantUrl.substring(0, 80) + '...');
  
  const variantResponse = await fetchWithReferer(variantUrl);
  console.log('  Status:', variantResponse.status);
  
  if (!variantResponse.ok) {
    console.log('  ERROR: Failed to fetch variant playlist');
    const errorText = await variantResponse.text();
    console.log('  Response:', errorText.substring(0, 200));
    return;
  }
  
  const variantPlaylist = await variantResponse.text();
  console.log('  Content-Type:', variantResponse.headers.get('content-type'));
  console.log('  Length:', variantPlaylist.length);
  console.log('\n  === VARIANT PLAYLIST CONTENT (first 2000 chars) ===');
  console.log(variantPlaylist.substring(0, 2000));
  console.log('  === END VARIANT PLAYLIST ===\n');
  
  // Step 4: Try to fetch first segment
  const segmentLines = variantPlaylist.split('\n');
  let segmentUrl = null;
  
  for (const line of segmentLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      if (trimmed.startsWith('http')) {
        segmentUrl = trimmed;
      } else if (trimmed.startsWith('/')) {
        const base = new URL(variantUrl);
        segmentUrl = `${base.origin}${trimmed}`;
      } else {
        const base = new URL(variantUrl);
        const basePath = base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);
        segmentUrl = `${base.origin}${basePath}${trimmed}`;
      }
      break;
    }
  }
  
  if (!segmentUrl) {
    console.log('ERROR: No segment URL found');
    return;
  }
  
  console.log('Step 4: Fetching FIRST SEGMENT...');
  console.log('  URL:', segmentUrl.substring(0, 100) + '...');
  
  const segmentResponse = await fetchWithReferer(segmentUrl);
  console.log('  Status:', segmentResponse.status);
  console.log('  Content-Type:', segmentResponse.headers.get('content-type'));
  console.log('  Content-Length:', segmentResponse.headers.get('content-length'));
  
  if (segmentResponse.ok) {
    const segmentBuffer = await segmentResponse.arrayBuffer();
    console.log('  Actual size:', segmentBuffer.byteLength, 'bytes');
    
    // Check first bytes to see if it's valid TS
    const firstBytes = new Uint8Array(segmentBuffer.slice(0, 10));
    console.log('  First bytes:', Array.from(firstBytes).map(b => b.toString(16).padStart(2, '0')).join(' '));
    
    // TS files start with 0x47 (sync byte)
    if (firstBytes[0] === 0x47) {
      console.log('  ✓ Valid MPEG-TS segment!');
    } else {
      console.log('  ✗ NOT a valid MPEG-TS segment');
    }
  }
  
  console.log('\n=== ANALYSIS COMPLETE ===');
}

main().catch(console.error);
