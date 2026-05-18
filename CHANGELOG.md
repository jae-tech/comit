# Changelog

All notable changes to this project will be documented in this file.

## [0.0.4] - 2026-05-19

### Added
- **LangGraph ReAct 에이전트** — 복잡한 질문에 AI가 추가 검색을 스스로 결정하고 실행하는 ReAct 루프 통합 (최대 3회 반복). 도구 호출 과정을 `thinking` SSE 청크로 실시간 확인 가능
- **멀티턴 대화 메모리** — LangGraph `load-history` 노드가 최근 10개 메시지를 LangChain `HumanMessage`/`AIMessage`로 변환해 LLM 컨텍스트에 주입. "아까 언급한 문서를 요약해줘" 같은 후속 질문이 가능해짐
- **Query Rewriting** — LangGraph `query-rewrite` 노드가 대화 히스토리를 바탕으로 지시어를 구체적인 검색 쿼리로 재작성해 pgvector 검색 정확도 개선
- **ReAct 사고 과정 시각화** — 채팅 UI에서 AI가 추가 검색 중일 때 `Search` 아이콘 + "검색 중: {쿼리}" 인디케이터 표시

### Fixed
- **채팅 세션-워크스페이스 소유권 검증** — 기존 세션 재사용 시 `workspaceId`를 검증하지 않아 자신의 세션 ID로 타인 워크스페이스 문서를 검색할 수 있던 인가 취약점 수정
- **PATCH /workspaces/:id name 필드 미적용** — `UpdateWorkspaceSchema`에 `name` 필드가 없어 워크스페이스 이름 변경 요청이 무시되던 버그 수정
- **TypeScript 타입 안전성** — `chat.service.ts`에서 `.bind(this)` → 화살표 함수 래퍼로 교체해 `@typescript-eslint/no-unsafe-assignment` 해소
- **authFetch 리프레시 경쟁 조건** — SSE 스트림과 일반 API 요청이 동시에 401을 받을 때 두 번째 리프레시가 이미 무효화된 토큰을 사용하는 문제. `isRefreshing: boolean` → `refreshPromise: Promise<string> | null` 공유 방식으로 해결
- **Gemini 임베딩 배치 제한** — `embedding.processor.ts`가 100개 초과 청크를 단일 요청으로 전송해 400 에러 발생. 100개 단위 배치 분할 처리로 수정
- **DemoThrottlerGuard IP 스푸핑** — `X-Forwarded-For` 헤더를 직접 신뢰하던 방식에서 Fastify `req.ips[0]` (trustProxy 검증 후 실제 클라이언트 IP)를 사용하도록 수정
- **DEMO_ENABLED=false 미적용** — 환경변수 설정 시 모든 데모 엔드포인트가 503을 반환하지 않던 문제. `onApplicationBootstrap`에 조기 반환 로직 추가
- **데모 도메인 루트 404** — `demo.com.it/` 루트 접속 시 `/demo/*` 리라이트가 적용되지 않던 문제. `proxy.ts` matcher에 `'/'` 추가

## [0.0.3] - 2026-05-15

### Added
- RAG 채팅 세션 삭제 기능 — 사이드바 대화 목록에서 휴지통 아이콘으로 삭제 가능
  - 2단계 확인 UI(행 내 인라인) + sonner 토스트 피드백 (성공/실패)
  - API: `DELETE /chat/sessions/:sessionId` (204, cascade 삭제)
  - 현재 보고 있는 세션 삭제 시 자동으로 새 대화 상태 전환

### Fixed
- RAG 채팅 "새 대화" 버튼을 눌러도 기존 세션으로 돌아오는 버그 수정
  - 원인: `setSessionIdWithUrl(undefined)` → URL 변경 → `searchParams` 변경 → `loadSession` useEffect 재실행 → 최신 세션 자동 복원
  - 수정: `isNewSessionRef` useRef 플래그로 자동 복원 차단

## [0.0.2] - 2026-05-15

### Changed
- 데모 어드민(`/demo/admin`)과 워크스페이스 설정 페이지의 시각 디자인 토큰 통일 — 섹션 카드 `rounded-lg` + `shadow-sm`, input focus ring `blue-700` accent으로 맞춤 (DESIGN.md 기준)
- Next.js `middleware.ts` → `proxy.ts` 마이그레이션으로 deprecation 경고 해소
- Provider 설정 페이지(`/settings/provider`)의 OpenAI 모델 셀렉트박스 즉시 표시 버그 수정 — stale closure 해소

## [0.0.1] - 2026-05-14

### Added
- BYOK RAG 워크스페이스 초기 구현 (OpenAI / Anthropic / Gemini 지원)
- Comit 로고/파비콘, 데모 페이지(`/demo`, `/demo/admin`), 챗봇 SSE 스트리밍
- 워크스페이스별 AI Provider 선택, 페르소나 이름/시스템 프롬프트 설정
- Demo 모듈 — 퍼블릭 SSE 채팅 엔드포인트, 레이트 리밋, 페르소나 프리셋 관리
- `@comit/shared` 패키지 — 공유 TypeScript 타입 (DTO, 스트림 청크, 응답 타입)
- Drizzle ORM 자동 마이그레이션, pgvector 임베딩 컬럼
