# SUPEREMBED PURE FETCH ANALYSIS - COMPLETE

## Summary

Superembed extraction follows a **different pattern** than 2embed and cloudstream. Here's what we discovered:

## Extraction Flow

### ✅ Steps 1-6: WORKING

1. **VidSrc Embed Page**: `https://vidsrc.xyz/embed/movie/{tmdbId}`
   - Successfully fetches (13KB)
   - Contains Superembed hash

2. **Extract Hash**: Pattern matching works
   - Hash format: Base64 encoded string
   - Example: `NDUwM2U0YzJlZjdlNWZjMzk5YTg5NWEwZTk4NDdhYTA6...`

3. **CloudNestra RCP Page**: `https://cloudnestra.com/rcp/{hash}`
   - Successfully fetches (5KB)
   - Contains srcrcp path (not prorcp!)

4. **Extract SrcRCP URL**: Pattern matching works
   - Format: `/srcrcp/{hash}`
   - Full URL: `https://cloudnestra.com/srcrcp/{hash}`

5. **Fetch SrcRCP Page**: Successfully fetches (298KB)
   - This is a FULL PLAYER PAGE, not a simple ProRCP page
   - Contains complete HTML/CSS/JS player implementation

### ❌ Step 7: DIFFERENT STRUCTURE

The SrcRCP page does NOT contain:
- Hidden div with encoded M3U8 data
- Simple base64 encoded URLs
- Direct M3U8 URLs in HTML

## Key Findings

### 1. SrcRCP vs ProRCP

**ProRCP** (used by 2embed/cloudstream):
- Simple page with hidden div
- Contains base64 encoded M3U8 URL
- Easy to extract with pure fetch

**SrcRCP** (used by superembed):
- Full player page with JavaScript
- M3U8 URL likely generated dynamically
- Requires JavaScript execution or API call interception

### 2. Player Page Structure

The SrcRCP page contains:
- Full HTML player interface
- Large JavaScript bundles (230KB+ inline script)
- Ad system configuration
- Player initialization code
- NO direct M3U8 URLs in source

### 3. Possible M3U8 Sources

The M3U8 URL is likely obtained through:

**Option A: JavaScript Execution**
- Player JavaScript fetches M3U8 from API
- Requires browser/Puppeteer to execute
- Similar to cloudstream's Playerjs decryption

**Option B: Hidden API Endpoint**
- Player makes fetch/XHR request to get M3U8
- Need to reverse engineer the API call
- Could be extracted from JavaScript

**Option C: Embedded in JavaScript**
- M3U8 URL encoded in JavaScript variables
- Need to parse and decode JavaScript
- Might be obfuscated

## Next Steps

### Approach 1: Puppeteer (Easiest, Working)

Use Puppeteer to:
1. Load the SrcRCP page
2. Intercept network requests
3. Capture M3U8 URL when player loads

**Pros:**
- Will definitely work
- No need to reverse engineer JavaScript
- Same approach as cloudstream

**Cons:**
- Requires headless browser
- Slower (~5-8 seconds)
- Higher resource usage

### Approach 2: JavaScript Analysis (Pure Fetch)

Analyze the inline JavaScript to find:
1. API endpoint for M3U8
2. Decryption/decoding logic
3. Request parameters needed

**Pros:**
- Pure fetch solution
- Fast (~1 second)
- Low resource usage

**Cons:**
- Requires reverse engineering
- May break if JavaScript changes
- Time-consuming to implement

### Approach 3: Hybrid (Recommended)

1. Use Puppeteer for initial discovery
2. Intercept the actual API call
3. Replicate API call with pure fetch
4. Cache results

**Pros:**
- Best of both worlds
- Fast after first request
- Reliable

**Cons:**
- More complex implementation
- Still needs Puppeteer initially

## Comparison with Other Providers

| Provider | RCP Type | Page Type | M3U8 Location | Pure Fetch? |
|----------|----------|-----------|---------------|-------------|
| 2embed | ProRCP | Simple | Hidden div | ✅ Yes |
| Cloudstream | ProRCP | Simple | Hidden div | ✅ Yes |
| Superembed | SrcRCP | Full Player | JavaScript/API | ❌ No (needs Puppeteer) |

## Recommendation

For **Superembed**, we should:

1. **Short term**: Use Puppeteer approach (like cloudstream)
   - Implement network interception
   - Capture M3U8 URL from player load
   - Works reliably

2. **Long term**: Reverse engineer the API
   - Analyze JavaScript to find API endpoint
   - Replicate API call with pure fetch
   - Optimize for speed

## Implementation Status

- ✅ VidSrc page fetching
- ✅ Hash extraction
- ✅ RCP page fetching
- ✅ SrcRCP URL extraction
- ✅ SrcRCP page fetching
- ❌ M3U8 extraction (needs Puppeteer or JS analysis)

## Files Created

- `SUPEREMBED-PURE-FETCH-FINAL.js` - Pure fetch extractor (steps 1-6)
- `analyze-superembed-rcp.js` - RCP page analysis
- `analyze-superembed-player.js` - Player page analysis
- `find-superembed-m3u8.js` - M3U8 search tool
- `SUPEREMBED-ANALYSIS-COMPLETE.md` - This file

## Conclusion

Superembed uses a **different architecture** than 2embed/cloudstream:
- Uses SrcRCP instead of ProRCP
- Serves full player page instead of simple hidden div
- Requires JavaScript execution or API reverse engineering

The pure fetch approach works for **steps 1-6**, but step 7 (M3U8 extraction) requires either:
- Puppeteer with network interception (recommended for now)
- JavaScript reverse engineering (future optimization)

---

**Date**: 2025-11-12
**Status**: Analysis Complete, Implementation Pending
**Next**: Implement Puppeteer-based M3U8 extraction for Superembed
