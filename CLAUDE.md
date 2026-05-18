# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Comit is a BYOK (Bring Your Own Key) RAG workspace — users upload documents and chat with AI using their own API keys. It's a pnpm + Turborepo monorepo with two apps and one shared package.

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
pnpm --filter @comit/api dev
pnpm --filter @comit/web dev
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
| `chat/` | RAG query: LangGraph StateGraph pipeline — load history → query rewrite → retrieve → ReAct generate; SSE streaming via `Observable<MessageEvent>`; `chat/graph/` contains nodes and tools |
| `demo/` | Public demo endpoints (no JWT): `/demo/chat` SSE, `/demo/docs`, `/demo/info`; rate-limited via `DemoThrottlerGuard` (10 req/60s per IP); `DemoAdminGuard` protects future write paths |
| `database/` | TypeORM entities, migrations, `DatabaseInitService` (ensures pgvector extension on boot) |
| `common/` | `@CurrentUser()` param decorator, `JwtAuthGuard` |

**LangGraph chat pipeline (`src/chat/graph/`):**

```
graph/
├── rag.graph.ts           ← StateGraph 정의 (RagState: workspaceId, sessionId, history, citations, ...)
├── rag-state.ts           ← RagState interface
├── nodes/
│   ├── load-history.node.ts   ← DB에서 chat_messages 최근 10개 로드 → HumanMessage/AIMessage 변환
│   ├── query-rewrite.node.ts  ← 대화 히스토리 기반 쿼리 재작성 (지시어 해소)
│   ├── retrieve.node.ts       ← pgvector 코사인 유사도 검색
│   └── generate.node.ts       ← LLM 생성 + ReAct 루프 (max 3 iterations); emits `thinking` SSE chunks
└── tools/
    └── document-search.tool.ts ← LangChain Tool 래퍼 (ReAct에서 추가 검색 시 사용)
```

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
- `src/lib/api.ts` — all API calls via axios with a `useAuthStore` interceptor that injects the JWT Bearer token on every request and clears auth + redirects to `/login` on 401. `demoApi` object provides unauthenticated URL helpers for demo endpoints. Token refresh uses a shared `refreshPromise: Promise<string> | null` to prevent race conditions when multiple requests 401 simultaneously.
- `src/store/auth.ts` — Zustand store persisted to localStorage as `comit-auth`; holds `accessToken` and `refreshToken`.
- Chat streaming uses `fetch` with SSE (not EventSource, since EventSource only supports GET). See `chatApi.queryUrl()` / `chatApi.queryHeaders()` in `api.ts`.
- `src/hooks/useDemoChat.ts` — demo-only hook; manages session ID via `useRef`, streams SSE chunks, handles `session_created`/`token`/`done`/`quota_exceeded`/`error` chunk types.
- `src/hooks/useStreamChat.ts` — authenticated workspace chat hook (mirrors demo hook pattern but uses JWT headers). Handles `thinking` SSE chunks (ReAct tool_call steps) by showing an animated search indicator; clears on first `token` chunk.
- `src/proxy.ts` — Next.js proxy: rewrites `demo.com.it/*` → `/demo/*` internally; redirects `/demo/*` on prod main domain to `demo.com.it`. (This project uses `proxy.ts`, not `middleware.ts` — both cannot coexist.)
- Routes: `/login`, `/register`, `/settings` (provider config), `/workspaces`, `/workspaces/[id]/chat`, `/workspaces/[id]/documents`, `/demo` (public chatbot widget), `/demo/admin` (read-only setup info).

### Shared (`packages/shared`)

Pure TypeScript types (no compiled output). Imported directly as source via `"main": "./src/index.ts"`. Contains DTOs and response types used by both API and web: `AuthTokens`, `RegisterDto`, `LoginDto`, `CreateProviderDto`, `ProviderResponse`, `ChatQueryDto`, `ChatStreamChunk`, `Citation`. `ChatStreamChunk` includes the `thinking` variant (`step: 'query_rewrite' | 'retrieve' | 'tool_call'`) emitted by the ReAct agent.

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

# Demo module (optional — omit to disable demo endpoints entirely)
DEMO_ENABLED=true             # set false to return 503 on all /demo/* routes
DEMO_USER_ID=                 # UUID of the pre-seeded demo user
DEMO_WORKSPACE_ID=            # UUID of the demo workspace
DEMO_ADMIN_TOKEN=             # static Bearer token for future write paths (DemoAdminGuard)
DEMO_HIDE_DOCS=false          # set true to omit document list from /demo/docs response
DEMO_DOMAIN=demo.com.it       # hostname that triggers middleware rewrite to /demo/*
```

## Database

PostgreSQL with pgvector extension. Schema managed via TypeORM migrations in `apps/api/src/database/migrations/`.

Key tables: `users`, `workspaces`, `ai_providers`, `documents`, `document_chunks` (with `vector(1536)` embedding column + HNSW index), `chat_sessions`, `chat_messages`.

When adding new entities, register them in the relevant module's `TypeOrmModule.forFeature([...])` — `autoLoadEntities: true` in `AppModule` picks them up automatically.

## Design System

UI tokens, color palette, typography, component patterns, and page layout rules are documented in [`DESIGN.md`](./DESIGN.md). Refer to it before adding new UI — especially for color tokens (`bg-[#faf9f7]`, `border-stone-200`, etc.), border-radius conventions, and status badge patterns.

## Testing

Tests use Vitest (not Jest) with the SWC plugin for compilation. The `vitest.config.ts` sets `root: './src'` so test files live alongside source. Guards and decorators from NestJS testing utilities work normally.
