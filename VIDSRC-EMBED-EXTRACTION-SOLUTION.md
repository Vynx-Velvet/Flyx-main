# VidSrc-Embed Stream Extraction Solution

## Overview

Successfully reverse-engineered and integrated the vidsrc-embed.ru → cloudnestra.com stream extraction flow into the application.

## Implementation Status: ✅ COMPLETE

### Files Modified/Created:
1. **`app/lib/services/vidsrc-extractor.ts`** - New VidSrc extraction service
2. **`app/api/stream/extract/route.ts`** - Added VidSrc as a provider option
3. **`app/components/player/VideoPlayer.tsx`** - Added VidSrc tab in server selection

## Extraction Flow

```
1. vidsrc-embed.ru/embed/{type}/{id}
   ↓ (extract iframe src)
2. cloudnestra.com/rcp/{hash}
   ↓ (extract prorcp URL from loadIframe function)
3. cloudnestra.com/prorcp/{hash}
   ↓ (extract div ID, encoded content, script hash)
4. cloudnestra.com/sV05kUlNvOdOxvtC/{script_hash}.js
   ↓ (execute in sandbox)
5. Decoded HLS URLs (replace {v1}, {v2}, etc. with domain)
```

## Key Technical Details

1. **Two-stage RCP flow**: The `/rcp/` endpoint returns a page with a play button that loads `/prorcp/` in an iframe. The prorcp hash is different from the rcp hash.

2. **Dynamic decoder scripts**: Each request gets a unique decoder script hash. The script is heavily obfuscated but can be executed in a Node.js VM sandbox.

3. **XOR-based encoding**: The encoded content is hex-encoded and XOR'd with a key derived from the div ID.

4. **Domain variables**: Stream URLs contain placeholders like `{v1}`, `{v2}` that need to be replaced with the actual domain (`shadowlandschronicles.com`).

## Usage

### In the Video Player
Users can now select "VidSrc" from the server selection menu (cloud icon in top-right corner of player).

### API Endpoint
```
GET /api/stream/extract?tmdbId=550&type=movie&provider=vidsrc
GET /api/stream/extract?tmdbId=1396&type=tv&season=1&episode=1&provider=vidsrc
```

## Test Results

### Movie (Fight Club - TMDB 550)
- ✅ 2/4 URLs working
- Working domain: `tmstr5.shadowlandschronicles.com`

### TV Show (Breaking Bad S01E01 - TMDB 1396)
- ✅ 2/4 URLs working
- Working domain: `tmstr5.shadowlandschronicles.com`

## Notes

- Stream URLs require the `Referer: https://cloudnestra.com/` header (handled by proxy)
- Some URLs may return 404 (different CDN domains like `app2.`) - these are filtered out
- The `tmstr5.shadowlandschronicles.com` domain is most reliable
