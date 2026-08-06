# Provider API Reference

## `BaseProvider`

Abstract base class for all content providers.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` (abstract) | Unique provider identifier |
| `priority` | `number` (abstract) | Lower = tried first during fallback |
| `supportedContent` | `ContentCategory[]` (abstract) | Content categories this provider handles |
| `enabled` | `boolean` | Whether the provider is active (default: `true`) |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `extract(request)` | `Promise<ExtractionResult>` | Extract stream sources (template method) |
| `fetchSourceByName(name, request)` | `Promise<StreamSource \| null>` | Fetch a specific source by name |
| `supportsContent(mediaType, metadata?)` | `boolean` | Check if provider handles content type |
| `getConfig()` | `ProviderConfig` | Serialisable provider configuration |

### Abstract Methods (must implement)

| Method | Returns | Description |
|--------|---------|-------------|
| `doExtract(request)` | `Promise<{sources, subtitles?, hexData?}>` | Actual extraction logic |

## `ProviderRegistry`

Central registry managing all providers.

| Method | Returns | Description |
|--------|---------|-------------|
| `register(provider)` | `void` | Register a provider instance |
| `get(name)` | `Provider \| undefined` | Get provider by name |
| `getForContent(mediaType, metadata?)` | `Provider[]` | Get enabled providers sorted by priority |
| `getAllEnabled()` | `Provider[]` | All enabled providers |
| `getAll()` | `Provider[]` | All registered providers |
| `serializeConfigs()` | `ProviderConfig[]` | All provider configs for API |
| `size` | `number` | Number of registered providers |
| `names` | `string[]` | Provider names sorted by priority |

## `ExtractionPipeline`

Unified extraction pipeline.

| Method | Returns | Description |
|--------|---------|-------------|
| `extract(request, options?)` | `Promise<ExtractionResult>` | Extract sources with fallback |
| `invalidateCache(namespace?)` | `void` | Clear extraction cache |

### `ExtractionOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `provider` | `string` | — | Force a specific provider |
| `sourceName` | `string` | — | Filter to a specific source |
| `signal` | `AbortSignal` | — | Cancel extraction |
| `cache` | `boolean` | `true` | Whether to cache results |
| `cacheTtl` | `number` | `900000` | Cache TTL in ms |
