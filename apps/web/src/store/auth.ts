import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// JWT exp 클레임을 base64 디코딩으로 파싱 (추가 라이브러리 불필요)
function parseJwtExp(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.exp === 'number' ? json.exp : null;
  } catch {
    return null;
  }
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      setTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken });

        // 만료 60초 전에 미리 갱신 (스트림 중단 방지)
        if (refreshTimer) clearTimeout(refreshTimer);
        const exp = parseJwtExp(accessToken);
        if (exp) {
          const msUntilRefresh = (exp * 1000) - Date.now() - 60_000;
          if (msUntilRefresh > 0) {
            refreshTimer = setTimeout(async () => {
              const { refreshToken: rt } = get();
              if (!rt) return;
              try {
                // api는 순환 참조 방지를 위해 동적 import
                const { api } = await import('@/lib/api');
                const res = await api.post<{ accessToken: string; refreshToken: string }>(
                  '/auth/refresh',
                  { refreshToken: rt },
                );
                get().setTokens(res.data.accessToken, res.data.refreshToken);
              } catch {
                // 조용히 실패 — 다음 요청 시 authFetch가 처리
              }
            }, msUntilRefresh);
          }
        }
      },
      clear: () => {
        if (refreshTimer) {
          clearTimeout(refreshTimer);
          refreshTimer = null;
        }
        set({ accessToken: null, refreshToken: null });
      },
    }),
    { name: 'comit-auth' },
  ),
);
