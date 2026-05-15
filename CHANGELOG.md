# Changelog

All notable changes to this project will be documented in this file.

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
