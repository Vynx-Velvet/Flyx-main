# Changelog

All notable changes to Flyx are documented in this file.

## [3.2.2] - 2026-09-26

### Fixed

- **macOS and Linux builds are runnable out of the box.** The macOS app is now ad-hoc code-signed at build time; a fully unsigned app was refused on Apple silicon as "damaged", so people had to clear quarantine flags and fix permissions in Terminal after every update. Gatekeeper now offers the normal right-click → Open path once per version, and updates pulled by the in-app updater carry no quarantine flag at all. On Linux the launcher, the bundled ffmpeg and the published AppImage carry the executable bit (a browser download still drops it once; the in-app updater and the `.deb` need nothing).

## [3.2.1] - 2026-09-26

### Fixed

- **Download dialog now lists real qualities.** The variant lookup fetched the provider's master playlist directly, which for VidSrc answers "401 no token" (the playlist needs the IP-bound token our stream proxy adds), so the dialog fell back to "Best available / Auto". The lookup now goes through the local stream proxy exactly like the player does and reads the variants from the rewritten playlist. Labels use standard tiers (a 1920×800 cinema-ratio stream is "1080p", not "800p") and generic "Auto" entries are hidden.
- **One extraction pipeline for the whole app.** Every API route built its own pipeline with its own 15-minute cache, and a provider's empty answer was cached as if it were a result — so one flaky extraction could pin the download dialog (and the VLC and downloader routes) to "no sources" for 15 minutes while the player happily played the same title. Routes now share a single pipeline, and empty or failed provider results are never cached.

## [3.2.0] - 2026-09-26

### Added

- **Watch progress and exact-second resume.** The player saves where you are every few seconds and on pause, hide, or leave, for every movie and episode. Reopening a title picks up at that second. Watchlist cards show a progress bar with a **Resume** pill ("Resume 1:02:15" for movies, "S2 E4 · 23 min left" for series) and Continue Watching resumes to the second as well, including anime. Finished titles drop out of the resume surfaces automatically.
- **Auto-next.** When an episode ends, an "Up next" card counts down (length set in Settings → Playback) and plays the next episode, rolling into the next season when needed, with **Play now** and **Cancel**. An "Up next" chip appears before the end (Settings → Playback → "Show Up Next before end"). The player previously had no end-of-episode handling at all.
- **External player: VLC and any other player.** Every player (movies and series, the mobile player, and Live TV) has an **External** menu with **Open in VLC**, **Copy stream link**, and **Download playlist (.m3u)**. The link is the stream as served by your Flyx host, so it plays in VLC, mpv, Kodi, or anything else on the network, and works from phones and other computers as well as the host.
  - Desktop app: VLC is found automatically (`FLYX_VLC_PATH` overrides) and launched at the current position; without VLC, a playlist is handed to the OS default player.
  - Android opens VLC via an intent, iOS via `vlc-x-callback`, other browsers download an `.m3u`.
  - Settings → Playback → **Open in VLC**: Off, show the button (default), or always open titles in VLC.
  - New `GET /api/stream/vlc` resolves a title on the host and returns an extended M3U (or JSON with `format=json`) whose entry is an absolute `/api/stream/proxy` URL on the host, so VLC needs no cookies or CDN headers.
- **Live TV availability check.** The channels behind on-air events are probed (cached three minutes) so the page can put playable events first and label the rest **Off air** or **Unsupported player** before you click. New `GET /api/livetv/availability`.
- **Real download qualities.** Most providers return one HLS master labelled "Auto", so the download dialog only offered "Best available". New `GET /api/downloads/qualities` expands each master into its 1080p / 720p / 480p variants, and both download paths select the matching variant so the choice is honoured.
- **Version everywhere.** The sidebar badge shows the running release (`v3.2.0`) instead of "Beta", read from the app's package version at build time; `/api/health` reports the same value.

### Changed

- **Live TV redesigned.** One clean column with three sections on the standard switcher: **Live now** (on-air cards in a responsive grid with **Ready** / **Off air** pills, plus "Up next" rows with real countdowns), **Sports** (every event as a scannable row grouped by sport, with wrapping sport chips), and **Channels** (850 channels as tiles with colour-coded monograms, category chips, a country picker, and paging). Search covers events and channels together. No horizontal scrolling at any width. The old sidebar, provider tabs, hero carousel, and timeline view are gone.
- **Refreshed interface.** New desktop and mobile headers with a "Now viewing" label, a redesigned sidebar, search page and search sidebar, downloads page and download dialog, settings pages, details pages, network settings, and content rails. Title-card badges (Movie / Series / Anime / Manga and the ★ rating) are pills with proper padding; the Movies / TV Shows switcher's highlight no longer clips the pill corners.
- **Header "Now viewing" is specific.** Browse pages read "Movies" or "TV Shows" (plus genre) instead of "Explore"; details, anime, and manga pages show the title being viewed ("Movie · Fight Club"); search shows the query. Switching between Movies and TV Shows updates it immediately.
- **Per-episode download button** is icon-only with a tooltip, and episode titles wrap to two lines before clipping.
- **Live TV player:** playlist loads fail fast (about two seconds) instead of twenty retries, and a 404/410/502/504 is treated as "off air": the player moves to the event's next stream automatically and only reports "offline" when every stream is out.

### Fixed

- **Live TV works again.** DLHD rotated its front domain (`dlhd.st` → `dlstreams.st` → `dlive.sx`), moved its player to a new host, and now disguises every segment as a PNG or WebP image on a public CDN. The extractor follows the redirect chain, reads the new plain-URL player config, and passes the real player origin along; the segment proxy decodes the transport stream out of the image wrappers (WebP EXIF, PNG trailer, PNG pixel-packed gzip, and marker-prefixed blobs) before handing it to the player. The schedule fetch tries a list of entry domains.
  - Signed CDN segment URLs were percent-decoded twice by the playlist and segment proxies, corrupting `%2B` signatures into `+` and causing 403s on some channels.
  - A channel with no live playlist now returns "Channel is offline right now" at once instead of timing out through every fetch strategy.
  - Event slots that embed third-party players (wikisport, embedsports) are reported as unsupported instead of falling back to the old host's dead addresses.
  - The player's channel menu never worked: switching streams snapped back to the first one in a loop. Fixed.
- **Live TV times were an hour off in summer.** The schedule publishes Europe/London wall-clock times (labelled "UK GMT", but BST in summer); they were treated as UTC. Times are converted properly now, "live" is derived from the real start instant with a 150-minute window and refreshes every minute, and "Up next" finally has entries because start times were never parsed before.
- **Live TV loads in about a second** after the first channel. Channel resolution, playlist, and segment fetches no longer probe an optional helper service on `127.0.0.1:9876` first (set `DLHD_SERVICE_URL` to opt in); when anything else owned that port, every request waited out an 8 s timeout. Resolutions are cached for ten minutes, other channels are probed directly on the last-seen edge host, and the playlist proxy pre-warms the newest segments so the player's first requests are served from memory.
- **Schedule names no longer show `&#039;` or `&amp;`.** HTML entities (including the page's double-encoded ampersands) are decoded in event titles, team names, channel names, and categories.
- **Playback stalls no longer restart the stream.** When the playhead sticks, the player seeks a second past the spot automatically (escalating 1 s → 2 s → 4 s → 8 s → 10 s if the same spot sticks again), hops over buffer holes, and only fails over to another source, at the same position, after five attempts. Previously hls.js nudged the same bytes, raised a fatal stall, and the player rebuilt the pipeline at the stall point or restarted from zero.
  - Fatal fragment/key load errors skip just past the bad fragment; other network errors resume in place; media errors are recovered in place at most twice per source; bad fragments fail fast (3 retries, 4 s cap).
  - A brief "Skipped a stuck spot" notice shows when this happens.
- **Episode download dialog** no longer hides behind episode tiles on the details page.
- **macOS: no more second Dock icon.** The embedded server runs in an Electron utility process on macOS instead of a separately spawned copy of the app binary. `FLYX_SERVER_HOST=child` restores the old mode; `FLYX_SERVER_HOST=utility` enables the utility process elsewhere.

### Developer notes

- Tailwind v4 spacing utilities do not apply in `packages/app`: `globals.css` has an unlayered universal reset that beats the layered utilities. Spacing belongs in plain CSS classes until the reset is moved into `@layer base`.
- New unit tests: external-player helpers, VLC launcher, stall recovery and recovery controller, watch-progress store, HLS variant parser, page labels, London-time conversion, DLHD segment unwrapping, and the desktop utility-process host.

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
