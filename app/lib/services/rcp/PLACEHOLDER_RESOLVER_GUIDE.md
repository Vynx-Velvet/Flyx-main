# Placeholder Resolver Guide

## Overview

The PlaceholderResolver resolves CDN placeholder variables (like `{v1}`, `{v2}`, etc.) in M3U8 URLs to actual shadowlandschronicles domain names. This is a critical step in the RCP extraction chain.

## Why Placeholders Exist

RCP providers use placeholders for several reasons:
- **CDN Load Balancing**: Distribute traffic across multiple CDN domains
- **Geographic Distribution**: Route users to nearest CDN server
- **Failover Redundancy**: Provide backup CDN options if primary fails
- **Anti-Scraping**: Obfuscate actual CDN domains to prevent simple scraping

## Placeholder Mapping

| Placeholder | Resolved Domain |
|-------------|-----------------|
| `{v1}` | shadowlandschronicles.com |
| `{v2}` | shadowlandschronicles.net |
| `{v3}` | shadowlandschronicles.io |
| `{v4}` | shadowlandschronicles.org |
| `{v5}` | shadowlandschronicles.com (fallback to v1) |

## Usage

### Basic Usage

```typescript
import { PlaceholderResolver } from './placeholder-resolver';

const resolver = new PlaceholderResolver('request-123');

// Resolve a single placeholder
const url = 'https://{v1}/content/872585/master.m3u8';
const resolved = resolver.resolve(url);
// Returns: ['https://shadowlandschronicles.com/content/872585/master.m3u8']
```

### Multiple Placeholders

```typescript
// URL with multiple placeholders
const url = 'https://{v1}/path/{v2}/master.m3u8';
const resolved = resolver.resolve(url);
// Returns: ['https://shadowlandschronicles.com/path/shadowlandschronicles.net/master.m3u8']
```

### Utility Function

```typescript
import { resolvePlaceholders } from './placeholder-resolver';

// Quick resolution without creating instance
const resolved = resolvePlaceholders('https://{v3}/content/master.m3u8', 'request-123');
// Returns: ['https://shadowlandschronicles.io/content/master.m3u8']
```

### Check for Placeholders

```typescript
const resolver = new PlaceholderResolver('request-123');

// Check if URL has unresolved placeholders
if (resolver.hasPlaceholders('https://{v1}/master.m3u8')) {
  console.log('URL needs resolution');
}
```

## Integration with Extraction Chain

The placeholder resolver is typically used after decoding the M3U8 URL:

```typescript
import { tryAllDecoders } from './srcrcp-decoder';
import { PlaceholderResolver } from './placeholder-resolver';

// Step 1: Decode the hidden div data
const decoderResult = await tryAllDecoders(encodedData, divId, requestId);

if (decoderResult) {
  // Step 2: Resolve placeholders
  const resolver = new PlaceholderResolver(requestId);
  const resolvedUrls = resolver.resolve(decoderResult.url);
  
  // Step 3: Use primary URL (first in array)
  const m3u8Url = resolvedUrls[0];
  
  console.log('Final M3U8 URL:', m3u8Url);
}
```

## Real-World Examples

### Example 1: Movie Stream
```typescript
// Decoded URL from ProRCP page
const decodedUrl = 'https://{v1}/cdn/movies/2024/872585/master.m3u8';

const resolver = new PlaceholderResolver('req-001');
const resolved = resolver.resolve(decodedUrl);

// Result: ['https://shadowlandschronicles.com/cdn/movies/2024/872585/master.m3u8']
```

### Example 2: TV Show Episode
```typescript
// Decoded URL with quality parameter
const decodedUrl = 'https://{v2}/cdn/tv/breaking-bad/s01e01/1080p/master.m3u8';

const resolved = resolvePlaceholders(decodedUrl, 'req-002');

// Result: ['https://shadowlandschronicles.net/cdn/tv/breaking-bad/s01e01/1080p/master.m3u8']
```

### Example 3: URL with Token
```typescript
// Decoded URL with authentication token
const decodedUrl = 'https://{v3}/content/master.m3u8?token=abc123&expires=1234567890';

const resolver = new PlaceholderResolver('req-003');
const resolved = resolver.resolve(decodedUrl);

// Result: ['https://shadowlandschronicles.io/content/master.m3u8?token=abc123&expires=1234567890']
```

## Static Methods

### Get Supported Placeholders
```typescript
const placeholders = PlaceholderResolver.getSupportedPlaceholders();
// Returns: ['{v1}', '{v2}', '{v3}', '{v4}', '{v5}']
```

### Get Domains for Placeholder
```typescript
const domains = PlaceholderResolver.getDomainsForPlaceholder('{v1}');
// Returns: ['shadowlandschronicles.com']

const unknown = PlaceholderResolver.getDomainsForPlaceholder('{v99}');
// Returns: undefined
```

## Error Handling

### Unknown Placeholders
If an unknown placeholder is encountered, the resolver will:
1. Log a warning
2. Use the placeholder content as fallback (e.g., `{v99}` → `v99`)
3. Continue processing

```typescript
const url = 'https://{v99}/path/master.m3u8';
const resolved = resolver.resolve(url);
// Returns: ['https://v99/path/master.m3u8']
// Logs: [WARN] Unknown placeholder: {v99}
```

### No Placeholders
If the URL has no placeholders, it's returned as-is:

```typescript
const url = 'https://example.com/master.m3u8';
const resolved = resolver.resolve(url);
// Returns: ['https://example.com/master.m3u8']
```

## Logging

The resolver logs all operations for debugging:

```typescript
// DEBUG: Found placeholders
// INFO: Resolved placeholders (with duration)
// WARN: Unknown placeholder (if encountered)
```

All logs include:
- Request ID for tracing
- Original URL
- Resolved URLs
- Duration in milliseconds

## Performance

- **Average resolution time**: < 1ms
- **Memory overhead**: Minimal (only stores resolved URLs)
- **No network calls**: Pure string manipulation

## Testing

Comprehensive tests cover:
- All placeholder variants (v1-v5)
- Multiple placeholders in one URL
- URLs without placeholders
- Edge cases (special characters, ports, authentication)
- Real-world scenarios

Run tests:
```bash
bun test app/lib/services/rcp/__tests__/placeholder-resolver.test.ts
```

## Requirements Coverage

This implementation satisfies:
- **Requirement 1.6**: 2Embed placeholder resolution
- **Requirement 2.6**: Superembed placeholder resolution
- **Requirement 3.6**: CloudStream placeholder resolution
- **Requirement 8.1**: Resolve {v1} to shadowlandschronicles.com
- **Requirement 8.2**: Resolve {v2} to shadowlandschronicles.net
- **Requirement 8.3**: Resolve {v3} to shadowlandschronicles.io
- **Requirement 8.4**: Resolve {v4} to shadowlandschronicles.org
- **Requirement 8.5**: Resolve {v5} to shadowlandschronicles.com
- **Requirement 8.6**: Log all placeholder replacements

## Next Steps

After placeholder resolution, the URL should be:
1. Validated using M3U8Validator (Task 8)
2. Returned to the client
3. Used for video streaming

See [M3U8 Validator Guide](./M3U8_VALIDATOR_GUIDE.md) for the next step in the chain.
