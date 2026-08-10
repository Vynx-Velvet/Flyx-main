# Flyx Streams — private Stremio add-on

This package turns Flyx's existing movie/TV extraction pipeline into a Stremio `stream` add-on that runs on one Cloudflare Worker. It does not host video files.

## Request flow

1. Stremio requests `/<ADDON_TOKEN>/stream/movie/tt0133093.json` or `/<ADDON_TOKEN>/stream/series/tt0944947:1:1.json`.
2. The Worker validates the private URL token and parses the IMDb, season, and episode values.
3. TMDB's `/find` API translates the IMDb ID to the numeric TMDB ID used by Flyx.
4. Flyx's `ExtractionPipeline` tries the registered VOD providers in priority order and returns their sources.
5. The Worker reshapes those sources into `{ streams: [...] }` for Stremio.
6. Direct streams stay direct. Streams requiring Referer/Origin headers, IP-bound tokens, or HLS segment rewriting go through the token-protected `/proxy` route.

## Permanent values

| Setting     | Value                    |
| ----------- | ------------------------ |
| Worker      | `flyx-stremio-private`   |
| Add-on      | `Flyx Streams`           |
| Manifest ID | `community.flyx.private` |
| Version     | `1.0.0`                  |
| Types       | `movie`, `series`        |
| Resource    | `stream`                 |

## Required secrets

Never commit either value.

- `TMDB_API_KEY`: your TMDB v3 API key. It translates Stremio's IMDb IDs to TMDB IDs.
- `ADDON_TOKEN`: at least 32 random URL-safe characters. It becomes the private, unguessable prefix in your install URL.

For local development, copy `.dev.vars.example` to `.dev.vars` and replace both placeholders. `.dev.vars` is ignored by Git.

## Local verification

From the repository root:

```bash
npm ci
npm run test:stremio
npm run type-check:stremio
npm run build --workspace @flyx/stremio-addon
```

Run the local Worker with:

```bash
npm run dev:stremio
```

Then open:

```text
http://localhost:8787/YOUR_ADDON_TOKEN/health
http://localhost:8787/YOUR_ADDON_TOKEN/manifest.json
```

## Cloudflare deployment

The Worker has deliberately not been created by this code change. When you are ready to create it from a computer:

```bash
npx wrangler login
npm ci
npm run deploy:stremio
npx wrangler secret put TMDB_API_KEY --config packages/stremio-addon/wrangler.toml
npx wrangler secret put ADDON_TOKEN --config packages/stremio-addon/wrangler.toml
```

The first deploy creates `flyx-stremio-private`. Adding the secrets updates the deployed Worker without putting them in GitHub. If you connect the repository in Cloudflare instead, keep the repository root as the build root, use `npm ci` as the build command, use `npm run deploy:stremio` as the deploy command, and add both values as encrypted runtime secrets.

After deployment, confirm the health route reports `tmdbConfigured: true`, then install this manifest URL in Stremio:

```text
https://flyx-stremio-private.YOUR-WORKERS-SUBDOMAIN.workers.dev/YOUR_ADDON_TOKEN/manifest.json
```

Do not publish that URL or submit it to Stremio's community catalog. Anyone who has the full URL also has the private token.
