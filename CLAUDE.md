# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Orbit is a BYOK (Bring Your Own Key) RAG workspace — users upload documents and chat with AI using their own API keys. It's a pnpm + Turborepo monorepo with two apps and one shared package.

## Commands

All commands can be run from the monorepo root via Turborepo:

```bash
pnpm dev          # start all apps in watch mode
pnpm build        # build all packages (respects dependency order)
pnpm lint         # lint all packages
pnpm test         # run all tests
pnpm db:generate  # generate TypeORM migration (run from apps/api)
pnpm db:migrate   # run pending migrations
```

Run commands scoped to a single package:

```bash
pnpm --filter @orbit/api dev
pnpm --filter @orbit/web dev
```

### API-specific

```bash
# from apps/api
pnpm test           # vitest run (unit tests, SWC compiler)
pnpm test:watch     # vitest in watch mode
pnpm test:cov       # coverage report
pnpm test:e2e       # e2e via test/vitest-e2e.config.ts
pnpm db:revert      # revert last migration
```

## Architecture

### Monorepo layout

```
apps/api      — NestJS backend (Fastify adapter, port 4000)
apps/web      — Next.js 16 frontend (port 3000)
packages/shared — shared TypeScript types only (no build step; imported via workspace:*)
```

### API (`apps/api`) — NestJS + Fastify

Key modules in `src/`:

| Module | Responsibility |
|---|---|
| `auth/` | JWT access + refresh tokens; refresh token blocklist via Redis |
| `providers/` | BYOK — stores encrypted AI provider keys (AES-256-GCM via `EncryptionService`) |
| `workspaces/` | Workspace CRUD; all other resources are scoped to a workspace |
| `documents/` | File upload → Bull queue → `EmbeddingProcessor` (chunking + OpenAI embeddings → pgvector) |
| `chat/` | RAG query: pgvector cosine similarity → LLM streaming via SSE (`Observable<MessageEvent>`) |
| `database/` | TypeORM entities, migrations, `DatabaseInitService` (ensures pgvector extension on boot) |
| `common/` | `@CurrentUser()` param decorator, `JwtAuthGuard` |

**Important runtime details:**
- API uses `@nestjs/platform-fastify`, not Express. Use Fastify-compatible APIs.
- `DatabaseInitService.onApplicationBootstrap` auto-enables pgvector and migrates the `embedding` column from `text` to `vector(1536)` on first boot.
- `synchronize: true` in non-production only — use migrations in production.
- The `EMBEDDING_QUEUE` (Bull/Redis) processes documents asynchronously. Embedding currently **only works with OpenAI** (MVP limitation); other providers will mark the document as `failed`.
- API keys are encrypted with AES-256-GCM before storage. `ENCRYPTION_KEY` env var must be a 64-char hex string (32 bytes).
- File uploads stored in `apps/api/uploads/` on disk (50 MB limit).
- Swagger docs available at `http://localhost:4000/docs`.

### Web (`apps/web`) — Next.js 16

**Note from `apps/web/AGENTS.md`:** This Next.js version has breaking changes from older versions — APIs, conventions, and file structure may differ from training data. Read `node_modules/next/dist/docs/` before writing Next.js-specific code.

Key patterns:
- `src/lib/api.ts` — all API calls via axios with a `useAuthStore` interceptor that injects the JWT Bearer token on every request and clears auth + redirects to `/login` on 401.
- `src/store/auth.ts` — Zustand store persisted to localStorage as `orbit-auth`; holds `accessToken` and `refreshToken`.
- Chat streaming uses `fetch` with SSE (not EventSource, since EventSource only supports GET). See `chatApi.queryUrl()` / `chatApi.queryHeaders()` in `api.ts`.
- Routes: `/login`, `/register`, `/settings` (provider config), `/workspaces`, `/workspaces/[id]/chat`, `/workspaces/[id]/documents`.

### Shared (`packages/shared`)

Pure TypeScript types (no compiled output). Imported directly as source via `"main": "./src/index.ts"`. Contains DTOs and response types used by both API and web: `AuthTokens`, `RegisterDto`, `LoginDto`, `CreateProviderDto`, `ProviderResponse`, `ChatQueryDto`, `ChatStreamChunk`, `Citation`.

## Environment Variables

Required in `.env` at the monorepo root (loaded by both apps):

```
DATABASE_URL=         # PostgreSQL connection string (must have pgvector extension)
REDIS_URL=            # Redis connection string
JWT_SECRET=           # JWT signing secret
JWT_REFRESH_EXPIRES=  # e.g. 7d
ENCRYPTION_KEY=       # 64 hex chars (32-byte AES key)
FRONTEND_URL=         # comma-separated allowed origins, e.g. http://localhost:3000
NEXT_PUBLIC_API_URL=  # frontend → API base URL, e.g. http://localhost:4000
```

## Database

PostgreSQL with pgvector extension. Schema managed via TypeORM migrations in `apps/api/src/database/migrations/`.

Key tables: `users`, `workspaces`, `ai_providers`, `documents`, `document_chunks` (with `vector(1536)` embedding column + HNSW index), `chat_sessions`, `chat_messages`.

When adding new entities, register them in the relevant module's `TypeOrmModule.forFeature([...])` — `autoLoadEntities: true` in `AppModule` picks them up automatically.

## Testing

Tests use Vitest (not Jest) with the SWC plugin for compilation. The `vitest.config.ts` sets `root: './src'` so test files live alongside source. Guards and decorators from NestJS testing utilities work normally.
