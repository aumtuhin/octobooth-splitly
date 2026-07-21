# Build context is the monorepo root, e.g.:
#   fly deploy .   (run from the repo root, where fly.toml lives)
FROM node:20-alpine AS builder
WORKDIR /app

COPY .npmrc package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY apps/api apps/api
RUN npm run build -w @splitly/api
RUN npm prune --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/prisma.config.ts ./apps/api/prisma.config.ts

WORKDIR /app/apps/api
EXPOSE 4000

# Start the server immediately so the machine becomes reachable fast on cold
# starts. Migrations run in the Fly release_command (see fly.toml), not here,
# so a sleeping/slow Neon database can't delay the app from listening.
CMD ["node", "dist/src/server.js"]
