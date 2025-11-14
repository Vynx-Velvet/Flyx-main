# RCP Extraction Infrastructure

Core infrastructure for extracting M3U8 streaming URLs from RCP providers (2Embed, Superembed, CloudStream Pro).

## Directory Structure

```
app/lib/services/rcp/
├── index.ts              # Main exports
├── types.ts              # TypeScript interfaces and types
├── http-client.ts        # Shared HTTP client with timeout/retry
├── request-id.ts         # Request ID generation for tracing
├── logger.ts             # Structured logging
├── hash-extractor.ts     # Hash extraction from VidSrc pages
├── rcp-fetcher.ts        # RCP page fetcher
└── README.md             # This file
```

## Core Components

### Types (`types.ts`)

Defines all TypeScript interfaces used throughout the RCP extraction system:

- `ExtractionRequest` - Input parameters for extraction
- `ExtractionParams` - Parameters passed to provider extractors
- `ExtractionResult` - Successful extraction result
- `ExtractionError` - Error information
- `ProviderAttempt` - Details about provider extraction attempt
- `StepResult` - Result from individual extraction step
- `ProviderConfig` - Provider configuration
- `HiddenDivData` - Hidden div extraction data
- `DecoderResult` - Decoder result with CDN variants
- `Decoder` - Decoder function interface
- `LogEntry` - Structured log entry
- `ERROR_CODES` - Standard error codes

### HTTP Client (`http-client.ts`)

Shared HTTP client for making requests with proper headers and error handling:

**Features:**
- Automatic retry with exponential backoff (default: 2 retries)
- Configurable timeout (default: 10 seconds)
- Proper browser-like headers (User-Agent, Accept, etc.)
- Support for Referer and Origin headers
- AbortController for timeout handling
- Standardized error responses

**Usage:**
```typescript
import { httpClient } from './http-client';

const response = await httpClient.fetch(
  'https://example.com',
  {
    timeout: 5000,
    retries: 2,
    referer: 'https://vidsrc.cc',
  },
  requestId
);
```

### Request ID (`request-id.ts`)

Utilities for generating and working with request IDs for tracing:

**Features:**
- Unique ID generation (format: `timestamp-random`)
- ID validation
- Timestamp extraction
- Request age calculation

**Usage:**
```typescript
import { generateRequestId } from './request-id';

const requestId = generateRequestId();
// Example: "1234567890123-a1b2c3d4"
```

### Logger (`logger.ts`)

Structured logging system for debugging and monitoring:

**Features:**
- Multiple log levels (DEBUG, INFO, WARN, ERROR)
- Request ID tracking
- Provider and step tracking
- Duration tracking
- Console output (configurable)
- Log storage and retrieval

**Usage:**
```typescript
import { logger } from './logger';

logger.info(requestId, 'Starting extraction', { tmdbId: '123' });
logger.debug(requestId, 'Hash extracted', { hash: 'abc...' }, '2embed', 'hash-extraction', 150);
logger.error(requestId, 'Extraction failed', { error: 'timeout' }, '2embed');
```

### Hash Extractor (`hash-extractor.ts`)

Extracts provider-specific hashes from VidSrc embed pages using multiple pattern matching strategies:

**Features:**
- 4 extraction patterns with automatic fallback
- Base64 validation
- Pattern success tracking
- Provider-specific extraction

**Usage:**
```typescript
import { hashExtractor } from './hash-extractor';

const hash = hashExtractor.extract(html, '2embed', requestId);
// Returns: "aHR0cHM6Ly9jbG91ZG5lc3RyYS5jb20vcmNwL2hhc2g="
```

### RCP Fetcher (`rcp-fetcher.ts`)

Fetches CloudNestra RCP pages with proper headers, timeout, and retry logic:

**Features:**
- CloudNestra URL construction from hash
- Proper header management (User-Agent, Referer, Origin)
- 10-second default timeout (configurable)
- 2 retry attempts with exponential backoff (configurable)
- Comprehensive error handling

**Usage:**
```typescript
import { rcpFetcher } from './rcp-fetcher';

const html = await rcpFetcher.fetch(
  hash,
  requestId,
  {
    timeout: 10000,
    retries: 2,
    referer: 'https://vidsrc.cc/v2/embed/movie/123456'
  }
);
```

**Configuration:**
```typescript
// Set global defaults
rcpFetcher.setDefaultTimeout(15000);
rcpFetcher.setDefaultRetries(3);
```

### ProRCP Extractor (`prorcp-extractor.ts`)

Extracts ProRCP player URLs from CloudNestra RCP pages using multiple pattern matching strategies:

**Features:**
- 8 extraction patterns with automatic fallback
- Support for both `/prorcp/` and `/srcrcp/` variants
- jQuery iframe creation detection
- Direct iframe tag detection
- JavaScript variable assignment detection
- Object property assignment detection
- Path validation (length, characters)
- Pattern success tracking for optimization
- Full URL construction with cloudnestra.com domain

**Patterns:**
1. jQuery iframe creation for prorcp: `$('<iframe>').attr('src', '/prorcp/HASH')`
2. Direct iframe tag for prorcp: `<iframe src="/prorcp/HASH">`
3. JavaScript variable for prorcp: `var url = "/prorcp/HASH"`
4. Object property for prorcp: `url: "/prorcp/HASH"`
5. jQuery iframe creation for srcrcp: `$('<iframe>').attr('src', '/srcrcp/HASH')`
6. Direct iframe tag for srcrcp: `<iframe src="/srcrcp/HASH">`
7. JavaScript variable for srcrcp: `var url = "/srcrcp/HASH"`
8. Object property for srcrcp: `url: "/srcrcp/HASH"`

**Usage:**
```typescript
import { proRcpExtractor } from './prorcp-extractor';

const proRcpUrl = proRcpExtractor.extract(rcpHtml, '2embed', requestId);
// Returns: "https://cloudnestra.com/prorcp/aHR0cHM6Ly9..."
// or: "https://cloudnestra.com/srcrcp/aHR0cHM6Ly9..."
```

**Pattern Statistics:**
```typescript
// Get pattern success rates
const stats = proRcpExtractor.getPatternStats();
stats.forEach((stat, patternName) => {
  console.log(`${patternName}: ${stat.successes}/${stat.attempts}`);
});

// Reset statistics
proRcpExtractor.resetPatternStats();
```

## Environment Variables

- `NODE_ENV` - Set to 'production' for INFO level logging (default: DEBUG in dev)
- `LOG_EXTRACTION_STEPS` - Set to 'true' to enable detailed step logging

## Error Handling

All errors follow a standardized format using `ExtractionError`:

```typescript
{
  code: 'HASH_NOT_FOUND',
  message: 'Could not extract hash from VidSrc page',
  provider: '2embed',
  step: 'hash-extraction',
  details: { patterns: 4, html: '...' },
  requestId: '1234567890123-a1b2c3d4'
}
```

### Error Codes

- `HASH_NOT_FOUND` - Provider hash not found in VidSrc page
- `RCP_FETCH_FAILED` - Failed to fetch CloudNestra RCP page
- `PRORCP_NOT_FOUND` - ProRCP URL not found in RCP page
- `PRORCP_FETCH_FAILED` - Failed to fetch ProRCP page
- `M3U8_NOT_FOUND` - M3U8 URL not found in player page
- `M3U8_INVALID` - M3U8 URL failed validation
- `TIMEOUT` - Request timeout
- `NETWORK_ERROR` - Network/HTTP error
- `ALL_PROVIDERS_FAILED` - All providers failed
- `HIDDEN_DIV_NOT_FOUND` - Hidden div not found in page
- `DECODE_FAILED` - Failed to decode M3U8 URL

## Next Steps

This infrastructure will be used by:

1. ✅ Hash extraction service
2. ✅ RCP page fetcher
3. ✅ ProRCP URL extractor
4. Hidden div extractor
5. Decoder service
6. Placeholder resolver
7. M3U8 validator
8. Provider-specific extractors (2Embed, Superembed, CloudStream)
9. Unified extractor

## Requirements Satisfied

This implementation satisfies the following requirements:

- **1.1, 2.1, 3.1**: Core infrastructure for all three providers
- **1.2, 2.2, 3.2**: RCP page fetching with proper headers and timeout
- **1.3, 2.3, 3.3**: ProRCP URL extraction with multiple patterns
- **6.1, 6.2, 6.3, 6.4, 6.5**: ProRCP URL extraction patterns (jQuery, iframe, variable, SrcRCP)
- **9.5**: Request ID generation for logging and tracing
- **10.2**: Retry logic with exponential backoff
- **10.3**: Configurable timeout handling
