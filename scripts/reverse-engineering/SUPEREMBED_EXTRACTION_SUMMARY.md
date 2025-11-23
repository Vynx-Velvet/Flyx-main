# SUPEREMBED M3U8 EXTRACTION - FINAL SUMMARY

## What We Discovered

1. **vidsrc-embed.ru → cloudnestra.com/rcp → cloudnestra.com/prorcp**
   - This is the iframe chain

2. **The PRORCP page contains a variable `JoAHUMCLXV`** (div with ID) that holds encoded player data

3. **The data is custom base64 encoded** using PlayerJS's shuffled alphabet

4. **After decoding, the data appears to be binary/compressed** but standard decompression (gzip/zlib/deflate) fails

## The Problem

The decoded data from `JoAHUMCLXV` is NOT decompressing with standard methods. This means:
- It's either using a custom compression algorithm
- Or it's encrypted  
- Or it's in a proprietary PlayerJS format that requires their JavaScript to process

## Solution

Since fetch-only extraction is hitting a wall with the binary format, we have two options:

### Option 1: Use Browser Automation
Use Puppeteer/Playwright to:
1. Load the prorcp page
2. Let PlayerJS initialize
3. Extract the processed M3U8 URLs from the player object in JavaScript

### Option 2: Reverse Engineer PlayerJS Further
The script at `/pjs/pjs_main_drv_cast.061125.js` processes the `JoAHUMCLXV` variable.
We need to:
1. Fetch that script
2. Analyze how it processes the binary data
3. Replicate that logic in Node.js

## Current Status

✓ Successfully traced the full request chain  
✓ Found the encoded data location  
✓ Decoded the custom base64  
✗ Unable to decompress/decrypt the final payload with fetch-only

## Recommendation

**Use browser automation** as the most reliable method since:
- PlayerJS is designed to run in a browser
- The decryption/decompression logic is client-side
- The M3U8 URLs are only available after JavaScript processes the data

SOURCES_START
(No M3U8 URLs extracted - requires browser execution or further PlayerJS reverse engineering)
SOURCES_END
