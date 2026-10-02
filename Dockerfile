# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: builder — install production dependencies (incl. native builds)
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Toolchain needed to compile native addons (e.g. bcrypt) on Alpine/musl.
RUN apk add --no-cache python3 make g++

# Install only production dependencies from the lockfile for reproducible builds.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------------------------------------------------------------------------
# Stage 2: runtime — minimal image, non-root, low memory footprint
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runtime

# Small runtime memory profile so the API stays light under load.
ENV NODE_ENV=production \
    NODE_OPTIONS=--max-old-space-size=192 \
    PORT=3000 \
    TINI_SUBREAPER=1

WORKDIR /app

# Copy built dependencies from the builder stage.
COPY --from=builder /app/node_modules ./node_modules

# Copy application source.
COPY . .

# Run as the unprivileged user that ships with the official Node image.
USER node

EXPOSE 3000

# Basic container-level health check against the root endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/app.js"]