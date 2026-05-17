# TODOS

## Security / Reliability (from /ship adversarial review 2026-05-14)

- [ ] **authFetch 리프레시 경쟁 조건 (P1)** — `apps/web/src/lib/api.ts`의 `authFetch()`와 axios 인터셉터가 각자 독립적인 `isRefreshing` 플래그를 가짐. SSE 스트림 개시 타이밍에 두 경로가 동시에 401을 받으면 두 번째 리프레시 시도가 이미 무효화된 토큰을 사용 → 강제 로그아웃. 수정: `isRefreshing` 플래그와 `refreshPromise`를 모듈 스코프에서 axios 인터셉터와 `authFetch` 사이에 공유.

- [ ] **Gemini batchEmbedContents 배치 크기 제한** — `embedding.processor.ts`의 `embedChunks`가 모든 청크를 단일 요청으로 전송. Gemini API 최대 100개 제한 초과 시 400 에러. 수정: 100개 단위로 청크 분할 후 순차/병렬 배치 전송.

- [ ] **DemoThrottlerGuard IP 스푸핑** — `getTracker()`가 `X-Forwarded-For` 헤더를 그대로 신뢰. 공격자가 헤더를 위조해 제한 우회 가능. 수정: Fastify `trustProxy` 설정으로 신뢰 가능한 프록시 홉 수 지정.

- [ ] **middleware.ts 데모 도메인 루트 누락** — `demo.com.it/`(루트)는 `/demo/*` 리라이트 규칙에 매칭되지 않아 404. 수정: `pathname === '/'` 조건을 데모 도메인 리라이트에 추가.

- [ ] **DEMO_ENABLED=false 미적용** — `demo.controller.ts`에 `DEMO_ENABLED` 환경변수 실제 적용 로직 확인 및 전 엔드포인트 503 반환 보장.

## Demo Pages (from /plan-ceo-review 2026-05-14)

- [ ] **Demo session cleanup** — periodic `DELETE FROM chat_sessions WHERE user_id = $DEMO_USER_ID AND created_at < NOW() - INTERVAL '7 days'`; implement as a NestJS `@Cron` task in `DemoModule` or a DB cron job. Context: demo sessions accumulate unbounded under `DEMO_USER_ID`.

- [ ] **Document upload/delete from /admin** — POST/DELETE `/demo/documents` endpoints so the operator can update demo documents without logging into the main app. Needs: (1) design the auth model for public write paths (static token? operator session?), (2) ensure Multer/multipart handling works on `/demo/*` routes. Defer to sprint after demo pages land.

- [ ] **Public workspace flag (`isPublic`)** — Add `isPublic: boolean` to `workspaces` table. Any workspace can then be shared via public URL (not just the fixed `DEMO_WORKSPACE_ID`). Requires: Drizzle migration, auth flow changes in `WorkspacesService`, new URL routing pattern. L effort.

- [ ] **Demo observability** — Structured logging for demo requests (`{ sessionId, questionLength, provider, latencyMs }`) + Grafana panel for demo chats/min. Useful for detecting when a demo deck goes live (traffic spike). Also: log rejected `DemoAdminGuard` attempts.

- [ ] **`useDemoChat` unit tests** — RTL tests for `session_created` chunk (sessionId stored in ref), `error` chunk (error rendered in bubble), `quota_exceeded` chunk (Korean message shown).

- [ ] **Demo rate limit E2E test** — verify 11th request within 60s returns 429; confirm `DemoThrottlerGuard.getTracker()` reads correct IP behind proxy.

- [ ] **ThrottlerModule Redis store** — `DemoModule`의 `ThrottlerModule.forRoot()`는 인메모리 저장소를 사용. 다중 인스턴스 배포 시 IP별 제한이 인스턴스마다 독립적으로 동작하여 사실상 무력화됨. 프로덕션 다중 인스턴스 환경에서는 `@nestjs/throttler` + `ThrottlerStorageRedisService`로 교체 필요.

- [ ] **Demo 테스트 파일 작성** — `apps/api/src/demo/demo.service.spec.ts` (onApplicationBootstrap 검증, enabled=false 503, getDocs DEMO_HIDE_DOCS), `apps/api/src/demo/demo-admin.guard.spec.ts` (토큰 검증 4 케이스), `apps/api/src/demo/demo.controller.spec.ts` (SSE Content-Type, 빈 question 400, getDocs/getInfo 200). Test plan: `~/.gstack/projects/orbit/jae-tech-main-test-plan-20260514-115730.md`

## Usage Dashboard (from /plan-ceo-review 2026-05-15)

- [ ] **사용량 알림 임계값 (P2)** — 월 $X 초과 시 UI 경고 배너. `users` 테이블에 `budget_usd` NUMERIC 컬럼 추가 필요. `/usage` 페이지 안정화 후 구현. Effort: L (human) / M (CC+gstack). Context: 현재 대시보드는 토큰+비용 표시만. 알림은 사용자가 예상치 못한 비용을 방지하는 다음 단계. Where: `apps/api/src/users/`, `apps/web/src/app/usage/`.

- [ ] **사용량 데이터 CSV 내보내기 (P3)** — `GET /usage/export?from=YYYY-MM-DD&to=YYYY-MM-DD` → CSV 다운로드. 회계 처리/월별 정산에 유용. 포트폴리오 차별성 포인트. Effort: S (human) / XS (CC+gstack). Context: 대시보드 UI 증명 후 백엔드 엔드포인트 1개 추가. Where: `apps/api/src/usage/usage.controller.ts`.

## Zod 마이그레이션 후속 (from /plan-eng-review 2026-05-15)

- [ ] **프론트엔드 폼 검증 zodResolver 연동 (P3)** — shared에 Zod 스키마 생기면 로그인/회원가입 폼에 `react-hook-form + @hookform/resolvers/zod`로 동일 규칙 재사용. 현재 @comit/web에 react-hook-form 없음. Effort: XS (CC+gstack). **Depends on:** Zod 전환 완료. Where: `apps/web/src/app/login/`, `apps/web/src/app/register/`.
