# Flyx 3.0 — Production Docker Image
# Multi-stage build for minimal size

# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN apk add --no-cache python3 curl

WORKDIR /app

# Root workspace config
COPY package.json package-lock.json turbo.json ./
COPY packages/config/package.json packages/config/
COPY packages/core/package.json packages/core/
COPY packages/extractors/package.json packages/extractors/
COPY packages/providers/package.json packages/providers/
COPY packages/app/package.json packages/app/

RUN npm ci --omit=optional

# Source
COPY packages/config/src packages/config/src
COPY packages/core/src packages/core/src
COPY packages/extractors/src packages/extractors/src
COPY packages/providers/src packages/providers/src
COPY packages/app/src packages/app/src
COPY packages/app/public packages/app/public
COPY packages/app/next.config.ts packages/app/next.config.ts
COPY packages/app/postcss.config.mjs packages/app/postcss.config.mjs
COPY packages/app/tsconfig.json packages/app/tsconfig.json

# Build Next.js
RUN cd packages/app && npm run build

# ── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache python3 curl

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DLHD_SERVICE_URL=http://127.0.0.1:9876

# Copy built app
COPY --from=builder /app/packages/app/.next packages/app/.next
COPY --from=builder /app/packages/app/public packages/app/public
COPY --from=builder /app/packages/app/next.config.ts packages/app/next.config.ts
COPY --from=builder /app/packages/app/package.json packages/app/package.json
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/package.json package.json

# Copy Python extraction microservice
COPY dlhd_service.py ./

EXPOSE 3000

# Start both the Python extraction service and Next.js
CMD python3 dlhd_service.py & \
    cd packages/app && \
    npx next start --port 3000
