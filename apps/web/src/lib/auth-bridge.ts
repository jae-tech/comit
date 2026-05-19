// api.ts ↔ auth.ts 순환 참조 브레이커
// api.ts와 auth.ts 모두 이 모듈에만 의존 — 서로 직접 import하지 않는다.

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  setTokens: (a: string, r: string) => void;
  clear: () => void;
}

type GetState = () => AuthState;

let _getState: GetState = () => ({
  accessToken: null,
  refreshToken: null,
  setTokens: () => {},
  clear: () => {},
});

export function registerGetAuthState(fn: GetState) {
  _getState = fn;
}

export function getAuthState(): AuthState {
  return _getState();
}
