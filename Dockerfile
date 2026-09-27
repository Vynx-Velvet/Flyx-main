# Flyx 3.0 — Production Docker Image
# Multi-stage build.
#
# Base images are pinned by digest (node:22-bookworm-slim, multi-arch index,
# resolved 2026-09-26). To update: pull the new tag and replace the digest.
# Debian (glibc) rather than Alpine: the lockfile carries the linux-x64-gnu
# Tailwind/lightningcss native binaries, not the musl ones.

# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c AS builder

WORKDIR /app

# Root workspace config + every workspace package (npm ci needs all
# workspaces the lockfile lists). .dockerignore keeps node_modules, build
# output and any .env files out of the context.
COPY package.json package-lock.json turbo.json tsconfig.base.json .npmrc ./
COPY packages ./packages
COPY tools ./tools
COPY scripts ./scripts

# The desktop workspace's Electron binary is never used in the container.
RUN ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --no-audit --no-fund

# Build Next.js with DUMMY secrets only (never baked into the image env).
RUN cd packages/app && \
    TMDB_API_KEY=dummy-key-for-build \
    JWT_SECRET=dummy-secret-for-build-0123456789abcdef \
    HOST_KEY=dummy-host-key-for-build \
    npx next build

# Drop dev-only weight that the runtime never needs.
RUN rm -rf packages/desktop packages/cli node_modules/electron node_modules/.cache

# ── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:22-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    FLYX_DATA_DIR=/data

# Built app + workspace sources (node_modules/@flyx/* are symlinks into
# packages/, so the packages must be present at runtime too).
COPY --from=builder --chown=root:root /app/package.json ./package.json
COPY --from=builder --chown=root:root /app/node_modules ./node_modules
COPY --from=builder --chown=root:root /app/packages ./packages
COPY --from=builder --chown=root:root /app/scripts/docker-entrypoint.mjs ./scripts/docker-entrypoint.mjs

# Persistent data (store.json, generated .env with JWT_SECRET/HOST_KEY)
# lives on a volume owned by the unprivileged `node` user.
RUN mkdir -p /data && chown node:node /data && chmod 700 /data
VOLUME ["/data"]

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

WORKDIR /app/packages/app
ENTRYPOINT ["node", "/app/scripts/docker-entrypoint.mjs"]
