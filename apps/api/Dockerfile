# ── base ───────────────────────────────────────────────────
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

# ── deps ───────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

# ── builder ────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

COPY package.json pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN pnpm --filter @comit/api build

# ── runner ─────────────────────────────────────────────────
FROM node:24-alpine AS runner
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
WORKDIR /app

ENV NODE_ENV=production

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared ./packages/shared

RUN mkdir -p /app/uploads

EXPOSE 4000
CMD ["node", "apps/api/dist/main"]
