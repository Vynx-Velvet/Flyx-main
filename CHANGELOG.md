# Changelog

All notable changes to Flyx are documented in this file.

## [3.1.0] - 2026-08-20

### Added

- **Live TV playback** — fixed DLHD channel-ID resolution, CDN playlist/segment proxying, rotated-CDN TLS handling, backend selection, and player recovery so live channels load and continue playing reliably.
- **Subtitle sync delay** — shift subtitle timing in ±100 ms steps from the subtitle menu or an on-player HUD, with `[` / `]` keyboard shortcuts and a one-tap reset.
- **Subtitle sync HUD** — appears when subtitles turn on, stays while you adjust, and fades out after a few seconds of inactivity.
- **Custom subtitle upload** — add your own `.srt` or `.vtt` file to any title via the subtitle menu or by drag-and-dropping the file onto the player.
- **Remove uploaded subtitles** — uploaded tracks show a remove button in the subtitle menu.
- **Hardened subtitle parsing** — SRT → VTT conversion now handles BOM/CRLF/CR, whitespace-only separators, position hints, and unsupported tags; VTT output is normalized with a valid `WEBVTT` header across the uploader and the subtitle download/proxy routes.

### Changed

- The subtitle button is now always available during playback so custom subtitles can be added to any title, including anime.
