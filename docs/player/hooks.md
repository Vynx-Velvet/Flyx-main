# Player Hook API Reference

## `useProviderSources`

Single hook for provider source fetching. Replaces 5 duplicated fetch patterns from Flyx 2.0.

```tsx
import { useProviderSources } from "@flyx/player";

function VideoPlayer({ tmdbId, mediaType }: Props) {
  const {
    status, currentSource, provider,
    extract, tryNextSource, hasNextSource,
  } = useProviderSources({
    request: { tmdbId, mediaType },
  });
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `request` | `ExtractionRequest` | (required) | What to extract |
| `capToken` | `string` | — | CAPTCHA token if needed |
| `autoExtract` | `boolean` | `true` | Auto-extract on mount |

### Return Value

| Property | Type | Description |
|----------|------|-------------|
| `status` | `"idle" \| "loading" \| "success" \| "error"` | Current fetch state |
| `sources` | `StreamSource[]` | All available sources |
| `currentSource` | `StreamSource \| null` | Currently active source |
| `currentSourceIndex` | `number` | Index of current source |
| `provider` | `string \| null` | Provider that supplied sources |
| `error` | `string \| null` | Error message |
| `hasNextSource` | `boolean` | Whether a next source is available |
| `extract()` | `() => Promise<void>` | Manually trigger extraction |
| `tryNextSource()` | `() => void` | Switch to next source |
| `reset()` | `() => void` | Reset to initial state |

## `useHlsPlayer`

Consolidated HLS.js configuration. Replaces 3 duplicated configs from Flyx 2.0.

```tsx
import { useHlsPlayer } from "@flyx/player";

function Player({ source, onSourceError }: Props) {
  const {
    attachMedia, loadSource, isPlaying,
    togglePlay, setVolume, seekTo,
  } = useHlsPlayer(
    { maxSegmentErrors: 8 },
    onSourceError,
  );

  return <video ref={(el) => el && attachMedia(el)} />;
}
```

### Config Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxSegmentErrors` | `number` | `8` | Max segment errors before failover |
| `sourceStartTimeoutMs` | `number` | `5000` | Timeout for source to start |
| `maxRecoveryAttempts` | `number` | `2` | Max HLS recovery attempts |
| `playbackSpeed` | `number` | `1.0` | Initial playback speed |
| `startMuted` | `boolean` | `true` | Start muted (autoplay policy) |

### Return Value

| Property | Type | Description |
|----------|------|-------------|
| `attachMedia(el)` | `(el: HTMLVideoElement) => void` | Attach HLS to video element |
| `detachMedia()` | `() => void` | Detach and destroy HLS |
| `loadSource(source)` | `(source: StreamSource) => void` | Load a new source |
| `isPlaying` | `boolean` | Whether currently playing |
| `togglePlay()` | `() => void` | Toggle play/pause |
| `speed` | `number` | Current playback speed |
| `setSpeed(s)` | `(speed: number) => void` | Set playback speed |
| `setVolume(v)` | `(volume: number) => void` | Set volume (0-1) |
| `seekTo(s)` | `(seconds: number) => void` | Seek to time |
| `recoverMediaError()` | `() => void` | Attempt recovery |
