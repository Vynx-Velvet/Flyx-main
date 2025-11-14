# M3U8 URL Validator Guide

## Overview

The M3U8 URL Validator ensures that extracted M3U8 streaming URLs are properly formatted and ready for use. It performs multiple validation checks to catch common issues before URLs are returned to clients.

## Features

- **Protocol Validation**: Ensures URLs start with `http://` or `https://`
- **Domain Validation**: Verifies URLs have valid, well-formed domains
- **Extension Validation**: Checks that URLs contain the `.m3u8` extension
- **Placeholder Validation**: Detects unresolved CDN placeholders like `{v1}`, `{v2}`, etc.
- **Optional Availability Check**: Can perform HTTP HEAD request to verify URL is accessible

## Usage

### Basic Usage

```typescript
import { M3U8Validator } from './m3u8-validator';

const validator = new M3U8Validator('request-123');

// Quick validation (no HTTP request)
const result = await validator.validateQuick(url);

if (result.valid) {
  console.log('URL is valid!');
} else {
  console.error('Validation failed:', result.error);
}
```

### Full Validation with Availability Check

```typescript
// Full validation (includes HTTP HEAD request)
const result = await validator.validateFull(url);

if (result.valid) {
  console.log('URL is valid and accessible!');
} else {
  console.error('Validation failed:', result.error, result.errorCode);
}
```

### Using Utility Functions

```typescript
import { validateM3U8Url } from './m3u8-validator';

// Quick validation
const result = await validateM3U8Url(url, 'request-123', false);

// Full validation
const result = await validateM3U8Url(url, 'request-123', true);
```

## Validation Checks

### 1. Protocol Validation

Ensures the URL starts with a valid HTTP protocol.

**Valid:**
- `https://example.com/master.m3u8`
- `http://example.com/master.m3u8`

**Invalid:**
- `example.com/master.m3u8` (no protocol)
- `ftp://example.com/master.m3u8` (wrong protocol)

### 2. Placeholder Validation

Checks for unresolved CDN placeholders that should have been replaced.

**Valid:**
- `https://shadowlandschronicles.com/master.m3u8`

**Invalid:**
- `https://{v1}/master.m3u8` (unresolved placeholder)
- `https://example.com/{cdn}/master.m3u8` (custom placeholder)

**Note:** This check runs BEFORE domain validation because placeholders in the hostname will cause domain validation to fail.

### 3. Domain Validation

Verifies the URL has a valid, well-formed domain using the URL constructor.

**Valid:**
- `https://shadowlandschronicles.com/master.m3u8`
- `https://cdn.example.com/master.m3u8` (subdomain)
- `https://example.com:8080/master.m3u8` (with port)

**Invalid:**
- `https://invalid domain/master.m3u8` (spaces in domain)
- `https://localhost/master.m3u8` (no TLD)

### 4. Extension Validation

Checks that the URL contains the `.m3u8` extension.

**Valid:**
- `https://example.com/master.m3u8`
- `https://example.com/video.m3u8?token=abc`
- `https://example.com/path/to/playlist.m3u8`

**Invalid:**
- `https://example.com/master.mp4` (wrong extension)
- `https://example.com/master.mpd` (DASH manifest)

### 5. Availability Check (Optional)

Performs an HTTP HEAD request to verify the URL is accessible.

**Configuration:**
- Timeout: 5 seconds
- Method: HEAD request
- User-Agent: Mozilla/5.0 (standard browser)

**When to Use:**
- Use `validateQuick()` for fast validation without network overhead
- Use `validateFull()` when you need to ensure the URL is actually accessible
- Availability check adds ~50-500ms latency depending on network

## Validation Result

```typescript
interface ValidationResult {
  valid: boolean;        // true if all checks pass
  error?: string;        // Human-readable error message
  errorCode?: string;    // Machine-readable error code
}
```

### Error Codes

- `M3U8_INVALID`: URL failed validation (protocol, domain, extension, or placeholder)
- `TIMEOUT`: Availability check timed out
- `NETWORK_ERROR`: Availability check failed due to network error

## Integration with Extraction Pipeline

The M3U8 validator is typically used at the end of the extraction pipeline:

```typescript
// 1. Extract hash from VidSrc page
const hash = await hashExtractor.extract(html, 'cloudstream');

// 2. Fetch RCP page
const rcpHtml = await rcpFetcher.fetch(hash, referer);

// 3. Extract ProRCP URL
const proRcpUrl = await proRcpExtractor.extract(rcpHtml);

// 4. Fetch ProRCP page
const playerHtml = await httpClient.get(proRcpUrl);

// 5. Extract hidden div
const hiddenDiv = await hiddenDivExtractor.extract(playerHtml);

// 6. Decode M3U8 URL
const decoderResult = await tryAllDecoders(hiddenDiv.encoded, hiddenDiv.divId);

// 7. Resolve placeholders
const urls = resolvePlaceholders(decoderResult.url, requestId);

// 8. Validate M3U8 URL ← YOU ARE HERE
const validator = new M3U8Validator(requestId);
const validationResult = await validator.validateQuick(urls[0]);

if (!validationResult.valid) {
  throw new Error(`Invalid M3U8 URL: ${validationResult.error}`);
}

return urls[0]; // Return validated URL
```

## Performance Considerations

### Quick Validation (Default)

- **Duration**: < 1ms
- **Network**: No network requests
- **Use Case**: Fast validation for most scenarios

### Full Validation (with Availability Check)

- **Duration**: 50-500ms (depends on network)
- **Network**: 1 HTTP HEAD request
- **Use Case**: When you need to ensure URL is accessible

### Recommendation

Use quick validation by default. Only use full validation when:
- Debugging extraction issues
- Testing new providers
- Validating cached URLs that may have expired

## Common Issues

### Issue: Placeholder validation fails

**Problem:** URL contains `{v1}`, `{v2}`, etc.

**Solution:** Ensure placeholders are resolved before validation:
```typescript
const urls = resolvePlaceholders(rawUrl, requestId);
const result = await validator.validateQuick(urls[0]);
```

### Issue: Domain validation fails with placeholder

**Problem:** Placeholder in hostname causes domain validation to fail

**Solution:** The validator checks placeholders BEFORE domain validation to provide better error messages.

### Issue: Extension validation fails

**Problem:** URL doesn't contain `.m3u8`

**Solution:** Check that you're extracting the correct URL. Some providers may return MP4 or other formats.

### Issue: Availability check times out

**Problem:** HTTP HEAD request takes > 5 seconds

**Solution:** 
- Use quick validation instead
- Check if the CDN is accessible from your server
- Try alternative CDN domains from the placeholder resolver

## Testing

The validator includes comprehensive tests covering:
- Protocol validation (http/https)
- Domain validation (valid/invalid domains)
- Extension validation (.m3u8 presence)
- Placeholder validation (unresolved placeholders)
- Availability checks (optional HTTP HEAD)
- Edge cases (empty URLs, special characters, etc.)

Run tests:
```bash
bun test app/lib/services/rcp/__tests__/m3u8-validator.test.ts
```

## Logging

The validator logs all validation attempts:

**DEBUG Level:**
- Starting validation
- Validation parameters

**INFO Level:**
- Successful validation
- Validation duration

**WARN Level:**
- Failed validation checks
- Error details

Example log output:
```
[DEBUG] [request-123] M3U8Validator Starting validation
[WARN] [request-123] M3U8Validator Placeholder validation failed
  url: https://{v1}/master.m3u8
  error: URL contains unresolved placeholders: {v1}
```

## Best Practices

1. **Always validate before returning URLs** to catch issues early
2. **Use quick validation by default** to minimize latency
3. **Log validation failures** for debugging
4. **Resolve placeholders first** before validation
5. **Handle validation errors gracefully** with fallback logic

## Example: Complete Validation Flow

```typescript
import { 
  M3U8Validator, 
  resolvePlaceholders,
  tryAllDecoders,
  HiddenDivExtractor 
} from './rcp';

async function extractAndValidate(
  playerHtml: string, 
  requestId: string
): Promise<string> {
  // Extract hidden div
  const hiddenDivExtractor = new HiddenDivExtractor(requestId);
  const hiddenDiv = await hiddenDivExtractor.extract(playerHtml);
  
  if (!hiddenDiv) {
    throw new Error('Hidden div not found');
  }
  
  // Decode M3U8 URL
  const decoderResult = await tryAllDecoders(
    hiddenDiv.encoded, 
    hiddenDiv.divId, 
    requestId
  );
  
  if (!decoderResult) {
    throw new Error('Failed to decode M3U8 URL');
  }
  
  // Resolve placeholders
  const urls = resolvePlaceholders(decoderResult.url, requestId);
  
  // Validate primary URL
  const validator = new M3U8Validator(requestId);
  const result = await validator.validateQuick(urls[0]);
  
  if (!result.valid) {
    throw new Error(`Invalid M3U8 URL: ${result.error}`);
  }
  
  return urls[0];
}
```

## API Reference

### M3U8Validator Class

#### Constructor
```typescript
new M3U8Validator(requestId: string)
```

#### Methods

**validate(url: string, checkAvailability?: boolean): Promise<ValidationResult>**
- Performs all validation checks
- `checkAvailability`: Whether to perform HTTP HEAD request (default: false)

**validateQuick(url: string): Promise<ValidationResult>**
- Convenience method for fast validation (no HTTP request)

**validateFull(url: string): Promise<ValidationResult>**
- Convenience method for thorough validation (includes HTTP request)

### Utility Functions

**createM3U8Validator(requestId: string): M3U8Validator**
- Factory function to create validator instance

**validateM3U8Url(url: string, requestId?: string, checkAvailability?: boolean): Promise<ValidationResult>**
- Utility function to validate without creating instance
- Default requestId: 'unknown'
- Default checkAvailability: false

## Related Components

- **PlaceholderResolver**: Resolves CDN placeholders before validation
- **SrcRCP Decoder**: Decodes M3U8 URLs from hidden divs
- **HiddenDivExtractor**: Extracts encoded data from ProRCP pages
- **Logger**: Logs validation attempts and results
