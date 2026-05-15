# Changelog

All notable changes to this project will be documented in this file.

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
