# vidsrc-embed.ru Decoder Summary

## Test Results
Tested against 3 different media items with 5-second delays between requests:
- **Fight Club** (TMDB 550) - Variable results (depends on which format is served)
- **Breaking Bad S01E01** (TMDB 1396) - ✅ Working with base64-shift3
- **Pulp Fiction** (TMDB 680) - Variable results

## Supported Encoding Formats

### 1. ROT3 Format
- **Detection**: Content starts with `eqqmp://`
- **Div IDs**: `o2VSUnjnZl`
- **Algorithm**: ROT3 cipher on alphanumeric characters only
- **Status**: ✅ Working

### 2. OLD Format  
- **Detection**: Div ID `eSfH1IRMyL` or content contains colons
- **Algorithm**: Reverse → Subtract 1 from each char → Hex decode
- **Status**: ✅ Working

### 3. BASE64 Format
- **Detection**: Standard base64 characters, may have `=` prefix
- **Div IDs**: `JoAHUMCLXV`, `TsA2KGDGux`, `Oi3v1dAlaM`, etc.
- **Algorithm**: 
  1. Strip leading `=` if present
  2. Reverse string
  3. URL-safe base64 decode
  4. Subtract shift value (3, 5, or 7) from each char
- **Status**: ✅ Working

### 4. HEX Format
- **Detection**: Pure hex characters (0-9, a-f)
- **Div IDs**: `ux8qjPHC66`, `sXnL9MQIry`
- **Algorithm**: Unknown - requires browser-based JS execution
- **Status**: ❌ Not supported

## Domain Placeholders
The decoded URLs contain placeholders that need replacement:
- `{v1}`, `{v2}`, `{v3}`, `{v4}` → `shadowlandschronicles.com`

## Notes
- The server randomly rotates between encoding formats
- 5-second delays between requests help avoid Cloudflare Turnstile
- The HEX format appears when rate-limited or challenged
- Success rate varies based on timing and server load
