# ── Stage 1: build ────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps first (layer cache)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source + configs
COPY tsconfig.json ./
COPY scripts/ ./scripts/
COPY src/ ./src/

# Type-check + bundle
RUN npm run build


# ── Stage 2: production ──────────────────────────────────────
FROM node:20-alpine AS runtime

LABEL org.opencontainers.image.title="ibkr-mcp" \
      org.opencontainers.image.description="MCP server for Interactive Brokers" \
      org.opencontainers.image.source="https://github.com/your-org/ibkr-mcp"

WORKDIR /app

# Non-root user
RUN addgroup -S mcp && adduser -S mcp -G mcp

# Production deps only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy bundle from builder
COPY --from=builder /app/dist/ ./dist/
COPY src/resources/server_instructions.md ./dist/resources/

# Env defaults (override at runtime)
ENV NODE_ENV=production \
    IB_HOST=host.docker.internal \
    IB_PORT=4002 \
    IB_CLIENT_ID=0 \
    LOG_LEVEL=info

USER mcp

ENTRYPOINT ["node", "dist/app.js"]
