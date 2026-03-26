# syntax=docker/dockerfile:1
# Multi-stage image: n8n-to-claw CLI (dist/) + web UI (Express + static Vite build).
# Runtime layout: /app/web (server) + /app/dist, /app/node_modules, /app/test-fixtures (parent of web).

FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY src ./src

RUN npm ci && npm run build && npm prune --omit=dev

WORKDIR /app/web

COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web/ ./
RUN npm run build && npm prune --omit=dev

WORKDIR /app
COPY test-fixtures ./test-fixtures


FROM node:20-bookworm-slim AS runner

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app/web

ENV NODE_ENV=production
ENV PORT=3847

COPY --from=builder /app/tsconfig.json ../tsconfig.json
COPY --from=builder /app/dist ../dist
COPY --from=builder /app/node_modules ../node_modules
COPY --from=builder /app/test-fixtures ../test-fixtures

COPY --from=builder /app/web/package.json ./package.json
COPY --from=builder /app/web/package-lock.json ./package-lock.json
COPY --from=builder /app/web/server.ts ./server.ts
COPY --from=builder /app/web/dist ./dist
COPY --from=builder /app/web/node_modules ./node_modules

EXPOSE 3847

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3847)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["./node_modules/.bin/tsx", "server.ts"]
