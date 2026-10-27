# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Install all dependencies once; used by the build and bot stages.
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production \
    NEXT_OUTPUT_STANDALONE=1
RUN npm run build

# Minimal Next.js standalone server. The runtime needs the drizzle folder
# because PGlite applies migrations on first start.
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN mkdir -p /app/.data/uploads && chown -R node:node /app
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/drizzle ./drizzle
# Defense in depth: runtime config comes from compose env, not a baked .env.
RUN rm -f /app/.env /app/.env.*
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]

# Telegram bot runs as a separate long-polling process. It uses the full
# toolchain (tsx) and must share PostgreSQL with the app — not PGlite.
FROM base AS bot
ENV NODE_ENV=production
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json tsconfig.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node bot ./bot
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node drizzle ./drizzle
USER node
CMD ["node", "./node_modules/tsx/dist/cli.mjs", "bot/index.ts"]
