# Flyx 3.0 — Source / Provider Inventory

**Last updated:** 2026-07-19  
**Domain probe date:** 2026-07-19 (HTTPS HEAD/GET)  
**Priority table:** `packages/config/src/priorities.ts`

---

## How to read this

| Field | Meaning |
|-------|---------|
| **RE status** | Reverse-engineering maturity of the extractor |
| **Impl** | Code under `packages/extractors/src/services/` |
| **Probe** | Host answers HTTP (≠ stream extraction always works) |

### RE status

| Status | Meaning |
|--------|---------|
| **Done** | Full chain documented + substantial extractor code |
| **Partial** | Important pieces RE’d but gaps remain (e.g. stream decode TODO) |
| **Stub** | Empty `{ sources: [] }` shell |
| **API-only** | Live routes/workers exist; package extractor still stub |

---

## Reverse-engineering complete (or near-complete)

User note: **multiple providers beyond vidsrc are already RE’d and implemented.**  
This inventory was corrected after re-reading the live extractors.

| Provider | File | Size | RE | Notes |
|----------|------|------|----|-------|
| **multiembed / 2embed** | `multiembed.ts` | ~16 KB | **Done** | Full 2embed chain (API → embed → XPS/Swish/Vesy/Vcr) |
| **videasy** | `videasy.ts` | ~14 KB | **Done** | seed + mvm1 decrypt → api.speedracelight.com multi-provider m3u8 |
| **vidcore** | `vidcore.ts` | ~10 KB | **Done** | vidcore.org `/api/sources?id=&type=` (+ skip rounds for multi-server) |
| **vidsrc / vsembed** | `vidsrc.ts` | ~6 KB | **Done** | Full vsembed → RCP → JWT → m3u8 |

### 1. multiembed / 2embed — **RE Done**

| | |
|--|--|
| **Registry** | `multiembed` · priority **4** |
| **Also known as** | 2embed |
| **Content** | movie, tv |

**Chain:**

1. `api.2embed.cc/{movie\|tv}?tmdb_id=` → IMDB / meta  
2. `www.2embed.cc/embed/{imdb\|tmdb}` or `/embedtv/{tmdb}&s=&e=` → server dropdown  
3. `streamsrcs.2embed.cc/{swish\|xps\|vesy\|vcr}?…` → intermediate  
4. Resolved players:
   - **Swish** → `2vcdn.skin/e/{hash}`
   - **Xps** → `play.xpass.top/e/movie|tv/…` + `backups[]` → `playlist.json` → m3u8  
   - **Vesy** → `player.videasy.to/…` (Videasy)  
   - **Vcr** → `vidcore.net/…` (VidCore)  
5. Subtitles via `sub.1x2.space` patterns when present  

**Probe (2026-07-19):**

| Domain | Role | Probe |
|--------|------|-------|
| `www.2embed.cc` | Embed | **200** |
| `api.2embed.cc` | Metadata API | **403** (up, blocks some IPs) |
| `streamsrcs.2embed.cc` | Server bridge | **200** |
| `play.xpass.top` | XPS player | **405** (up) |
| `2vcdn.skin` | Swish CDN | **200** |
| `sub.1x2.space` | Subs | **404** root (endpoint-specific) |

---

### 2. videasy — **RE Done**

| | |
|--|--|
| **Registry** | `videasy` · priority **1** |
| **Content** | movie, tv |

**Chain:**

1. `db.speedracelight.com/3/movie|tv/{id}` → title / year / imdb  
2. `api.speedracelight.com/seed?mediaId={tmdb}` → short-lived seed (rate-limited)  
3. `api.speedracelight.com/{cdn|neon2|m4uhd|meine|lamovie}/sources-with-title?…&enc=2&seed=`  
4. Decrypt base64 payload with custom PRNG (magic header `mvm1`) → `{ sources, subtitles }`  

| Domain | Role | Probe |
|--------|------|-------|
| `db.speedracelight.com` | TMDB proxy | **200** |
| `api.speedracelight.com` | Encrypted sources + seed | **200** |
| `player.videasy.to` | Player (RE source) | **200** |

**Also via 2embed Vesy:** `streamsrcs.2embed.cc/vesy?tmdb=` → player  

**Probe (tmdb 550):** 5–7 sources across Yoru/Neon/Breach/Killjoy/Omen + subtitles.

---

### 3. vidcore — **RE Done**

| | |
|--|--|
| **Registry** | `vidcore` · priority **9** |
| **Content** | movie, tv |

**Chain:**

1. `www.vidcore.org/api/sources?id={tmdb}&type=movie|tv` (+ `season`/`episode` for TV)  
2. Response mode `parallel-first-fastest` → nested `sources[].data.sources[]`  
3. Follow-up rounds with `skip={labels}` to collect more servers  
4. Fallback: RSC scrape on `vidcore.net` (legacy 2embed VCR host)  

| Domain | Role | Probe |
|--------|------|-------|
| `www.vidcore.org` | Sources API | **200** |
| `vidcore.org` | Sources API (alt) | **200** |
| `vidcore.net` | Embed host (2embed VCR) | **200** |

**Also via 2embed Vcr:** `streamsrcs.2embed.cc/vcr?tmdb=` → `vidcore.net`  

**Probe (tmdb 550):** 4 sources (Fabric / Nflix / Drag / Viet, etc.).

---

### 4. vidsrc / vsembed — **RE Done**

| | |
|--|--|
| **Registry** | `vidsrc` · priority **3** |

**Chain:**

1. `vsembed.ru/embed/movie?tmdb=`  
2. `cloudorchestranova.com/rcp/{hash}`  
3. `…/prorcp/{hash}`  
4. `sartorialsupernova.space/generate.php` → JWT  
5. `master.m3u8?token=` → variants  
6. Playback via `/api/stream/proxy` (Referer required)  

| Domain | Probe |
|--------|-------|
| `vsembed.ru` | **200** |
| `cloudorchestranova.com` | **200** |
| `sartorialsupernova.space` | **200** |
| `vidsrc.to` / `.me` / `.net` | **200** (brand portals; extractor uses vsembed) |

---

## Full provider registry (priorities)

| Pri | Name | Category | RE / impl | Domains (known) | Probe |
|-----|------|----------|-----------|-----------------|-------|
| 1 | **videasy** | VOD | **Done** | api.speedracelight.com, db.speedracelight.com | **200** |
| 2 | **vidlink** | VOD | Stub | vidlink.pro | **200** |
| 3 | **vidsrc** | VOD | **Done** | vsembed + RCP + CDN | **200** |
| 4 | **multiembed** | VOD | **Done** (2embed) | 2embed.cc ecosystem | **200** / 403 API |
| 5 | **bingebox** | VOD | Stub | — | — |
| 6 | **moviebox** | VOD | Stub | moviebox.ph | **200** |
| 7 | **primesrc** | VOD | Stub | primesrc.me | **200** |
| 8 | **uflix** | VOD | Stub | — | — |
| 9 | **vidcore** | VOD | **Done** | www.vidcore.org `/api/sources` | **200** |
| 10 | **animekai** | Anime | Stub | animekai.to | DNS_FAIL |
| 11 | **allanime** | Anime | Stub | allanime.day/to | FAIL/TIMEOUT |
| 12 | **hianime** | Anime | Stub (+ proxy hooks) | hianime.tv / .to | 200 / TIMEOUT |
| 13 | **miruro** | Anime | Stub (+ client shim) | miruro.tv / .to | **200** |
| 20 | **dlhd** | Live | API/arch partial | mirrors often DNS_FAIL | |
| 21 | **ntv** | Live | API → CF worker | media-proxy… | 429 |
| 22 | **globetv** | Live | API → CF worker | media-proxy… | 429 |
| 23 | **ufreetv** | Live | API partial | media-proxy… | 429 |
| 24 | **cdnlive** | Live | Worker + cinephage | cdn-live-extractor… | 429 / 401 |
| 30 | **streamninja** | Sports | Stub | — | — |
| 31 | **ppv** | Sports | API partial | ppv.to, api.ppv.to | 200 / SSL_ERR |
| 32 | **viprow** | Sports | API partial | viprow.nu | DNS_FAIL |
| 40 | **iptv** | IPTV | Stub | — | — |

**Note:** `flixer` was in earlier registry snapshots; current `priorities.ts` has **no FLIXER** entry (replaced by VIDCORE at 9). Proxy heuristics for Flixer CDN fingerprints may still exist in `stream-proxy.ts`.

---

## Relationship diagram (2embed hub)

```
                    ┌─────────────────┐
                    │  multiembed     │
                    │  (2embed.cc)    │
                    └────────┬────────┘
           ┌─────────────────┼─────────────────┐
           ▼                 ▼                 ▼
      Swish / XPS      Vesy → Videasy    Vcr → VidCore
      2vcdn / xpass    player.videasy.*   vidcore.net
```

Standalone providers also exist for **videasy** and **vidcore** (direct extractors, not only via 2embed).

---

## Stubs (empty extractors)

Still return empty sources:

`vidlink`, `bingebox`, `moviebox`, `primesrc`, `uflix`, `animekai`, `allanime`, `hianime`, `miruro`, `dlhd`, `ntv`, `globetv`, `ufreetv`, `cdnlive`, `streamninja`, `ppv`, `viprow`, `iptv`

---

## Infra (ours)

| Host | Role | Probe |
|------|------|-------|
| `media-proxy.vynx-3b3.workers.dev` | Stream/live proxy | 429 (up) |
| `cdn-live-extractor.vynx-3b3.workers.dev` | CDN live | 429 (up) |
| `/api/stream/extract` | Unified extract | local |
| `/api/stream/proxy` | Referer proxy (vidsrc) | local |

---

## Recommended next work

1. **Videasy** — finish `decodeStreamData` from residential player chunks  
2. **VidCore** — capture real stream API once with Bearer token on residential IP  
3. **Multiembed** — harden against `api.2embed.cc` 403 (IMDB path optional; TV already uses TMDB embed)  
4. **Vidlink / primesrc** — next pure stubs with live domains  
5. Keep server selector listing all correlating RE’d providers (done on `/watch`)

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-19 | Initial inventory (incorrectly marked only vidsrc as RE’d) |
| 2026-07-19 | **Correction:** multiembed/2embed, videasy, vidcore documented as implemented RE extractors; domain probes updated |
| 2026-07-20 | **videasy Done:** seed + mvm1 decrypt via api.speedracelight.com (7 sources on tmdb 550) |
| 2026-07-20 | **vidcore Done:** www.vidcore.org `/api/sources` + skip rounds (4 sources on tmdb 550) |
