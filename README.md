# Comit

문서를 업로드하고 AI와 대화하는 RAG 워크스페이스입니다. API 키는 직접 연결합니다 — 서버에 종속되지 않습니다.

## 주요 기능

- **문서 기반 AI 채팅** — PDF, TXT, MD 파일을 업로드하면 자동으로 임베딩되고, 그 내용을 바탕으로 AI와 대화할 수 있습니다
- **인용 출처 표시** — 답변마다 참조한 문서 청크를 표시해 신뢰할 수 있는 답변인지 직접 확인할 수 있습니다
- **워크스페이스별 AI 페르소나** — 워크스페이스마다 시스템 프롬프트와 페르소나 이름을 커스텀할 수 있습니다
- **BYOK (Bring Your Own Key)** — OpenAI, Anthropic, Gemini API 키를 직접 등록해 사용합니다. API 비용은 직접 부담하고, 키는 AES-256-GCM으로 암호화해 저장됩니다
- **실시간 스트리밍** — 채팅 응답과 임베딩 진행 상황 모두 SSE로 실시간 표시됩니다
- **공개 데모 페이지** — 회원가입 없이 바로 체험할 수 있는 플로팅 챗봇 위젯. IP당 분당 10회 요청 제한. `demo.com.it`에서 별도 도메인으로 운영 가능

## 스택

| 영역 | 기술 |
|---|---|
| 백엔드 | NestJS + Fastify, TypeORM, PostgreSQL + pgvector |
| 프론트엔드 | Next.js 16 (App Router), Zustand, Tailwind CSS |
| 인프라 | Redis + BullMQ (임베딩 큐), Docker Compose, Nginx |
| 모노레포 | pnpm + Turborepo |

## 시작하기

### 사전 요구사항

- Node.js 20+, pnpm 9+
- Docker + Docker Compose

### 로컬 개발 환경

**1. 의존성 설치**

```bash
pnpm install
```

**2. 환경변수 설정**

```bash
cp .env.example .env
```

`.env`를 열어 아래 값을 채웁니다.

```bash
# JWT 시크릿 (임의의 긴 문자열)
JWT_SECRET=your_jwt_secret

# AES 암호화 키 (32바이트 hex — openssl rand -hex 32 로 생성)
ENCRYPTION_KEY=your_32_byte_hex_key
```

**3. DB + Redis 실행**

```bash
docker compose -f docker-compose.dev.yml up -d
```

**4. 개발 서버 시작**

```bash
pnpm dev
```

- API: `http://localhost:4000`
- 웹: `http://localhost:3000`
- Swagger: `http://localhost:4000/docs`

### 전체 스택 Docker 실행

```bash
docker compose up -d
```

`http://localhost`으로 접속합니다. Nginx가 API와 웹을 프록시합니다.

## 프로젝트 구조

```
comit/
├── apps/
│   ├── api/          # NestJS 백엔드 (포트 4000)
│   │   └── src/
│   │       ├── auth/         # JWT 인증 + 리프레시 토큰
│   │       ├── workspaces/   # 워크스페이스 CRUD
│   │       ├── documents/    # 파일 업로드 + 임베딩 처리
│   │       ├── chat/         # RAG 쿼리 + SSE 스트리밍
│   │       ├── demo/         # 공개 데모 엔드포인트 (JWT 불필요)
│   │       ├── providers/    # BYOK API 키 관리
│   │       └── database/     # TypeORM 엔티티 + 마이그레이션
│   └── web/          # Next.js 프론트엔드 (포트 3000)
│       └── src/
│           ├── app/          # App Router 페이지
│           │   └── demo/     # 공개 데모 페이지 + 어드민 정보 페이지
│           ├── components/   # 공통 UI 컴포넌트
│           ├── hooks/        # useDemoChat, useStreamChat
│           ├── lib/          # API 클라이언트
│           ├── middleware.ts # demo.com.it 도메인 라우팅
│           └── store/        # Zustand 인증 스토어
├── packages/
│   └── shared/       # 공유 TypeScript 타입
├── nginx/            # Nginx 설정
└── docker-compose.yml
```

## 주요 명령어

```bash
pnpm dev              # 전체 개발 서버 시작
pnpm build            # 전체 빌드
pnpm test             # 전체 테스트
pnpm db:migrate       # DB 마이그레이션 실행
pnpm db:generate      # 새 마이그레이션 생성
```

특정 앱만 실행:

```bash
pnpm --filter @comit/api dev
pnpm --filter @comit/web dev
```

## 사용 방법

1. 회원가입 후 로그인합니다
2. **API 설정** 에서 OpenAI, Anthropic, Gemini 중 하나의 API 키를 등록합니다
3. **워크스페이스** 를 생성합니다
4. **문서** 탭에서 PDF, TXT, MD 파일을 업로드합니다 — 임베딩이 완료되면 채팅이 가능합니다
5. **채팅** 에서 문서 내용에 대해 질문합니다. 답변 아래 인용 출처를 클릭하면 참조한 원문을 확인할 수 있습니다

> 임베딩은 현재 OpenAI 모델만 지원합니다. 채팅 응답은 등록한 provider 모두 사용 가능합니다.

## 환경변수 전체 목록

| 변수 | 설명 | 예시 |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 연결 문자열 | `postgres://comit:secret@localhost:5432/comit` |
| `REDIS_URL` | Redis 연결 문자열 | `redis://localhost:6379` |
| `JWT_SECRET` | JWT 서명 시크릿 | 임의의 긴 문자열 |
| `JWT_ACCESS_EXPIRES` | 액세스 토큰 만료 | `15m` |
| `JWT_REFRESH_EXPIRES` | 리프레시 토큰 만료 | `7d` |
| `ENCRYPTION_KEY` | API 키 암호화용 AES 키 | `openssl rand -hex 32` |
| `NEXT_PUBLIC_API_URL` | 프론트엔드 → API URL | `http://localhost:4000` |
| `FRONTEND_URL` | CORS 허용 origin | `http://localhost:3000` |
| `DEMO_ENABLED` | 데모 기능 활성화 여부 | `true` |
| `DEMO_USER_ID` | 데모 전용 사용자 UUID | DB에서 미리 생성 |
| `DEMO_WORKSPACE_ID` | 데모 워크스페이스 UUID | DB에서 미리 생성 |
| `DEMO_ADMIN_TOKEN` | 데모 어드민 Bearer 토큰 | `openssl rand -hex 32` |
| `DEMO_HIDE_DOCS` | 문서 목록 숨김 여부 | `false` |
| `DEMO_DOMAIN` | 데모 전용 도메인 | `demo.com.it` |
