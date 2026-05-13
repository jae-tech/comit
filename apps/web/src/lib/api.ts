import axios from 'axios';
import { useAuthStore } from '@/store/auth';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const api = axios.create({ baseURL: BASE });

// 요청마다 zustand store에서 토큰 주입
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = useAuthStore.getState().accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 → refresh token으로 갱신 시도 → 실패하면 로그아웃
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const url: string = err.config?.url ?? '';
    const isAuthEndpoint = url.startsWith('/auth/');

    if (err.response?.status !== 401 || isAuthEndpoint || typeof window === 'undefined') {
      return Promise.reject(err);
    }

    const { refreshToken, setTokens, clear } = useAuthStore.getState();

    if (!refreshToken) {
      clear();
      window.location.href = '/login';
      return Promise.reject(err);
    }

    // 이미 갱신 중이면 대기열에 쌓음
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push((newToken) => {
          err.config.headers.Authorization = `Bearer ${newToken}`;
          resolve(api(err.config));
        });
        // 갱신 실패 시 reject — 갱신 성공 시 위 resolve가 먼저 호출되므로 실질적으로 실행 안 됨
        setTimeout(() => reject(err), 10000);
      });
    }

    isRefreshing = true;
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string }>(
        '/auth/refresh',
        { refreshToken },
      );
      const { accessToken: newAccess, refreshToken: newRefresh } = res.data;
      setTokens(newAccess, newRefresh);

      // 대기 중인 요청 모두 새 토큰으로 재시도
      refreshQueue.forEach((cb) => cb(newAccess));
      refreshQueue = [];

      err.config.headers.Authorization = `Bearer ${newAccess}`;
      return api(err.config);
    } catch {
      clear();
      window.location.href = '/login';
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  },
);

// ── Auth ──────────────────────────────────────────────
export const authApi = {
  register: (email: string, password: string) =>
    api.post<{ accessToken: string; refreshToken: string }>('/auth/register', { email, password }),
  login: (email: string, password: string) =>
    api.post<{ accessToken: string; refreshToken: string }>('/auth/login', { email, password }),
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),
};

// ── Workspaces ────────────────────────────────────────
export interface WorkspaceDetail {
  id: string;
  name: string;
  personaName: string | null;
  systemPrompt: string | null;
  createdAt: string;
}

export const workspaceApi = {
  list: () => api.get<WorkspaceDetail[]>('/workspaces'),
  create: (name: string) => api.post<WorkspaceDetail>('/workspaces', { name }),
  get: (id: string) => api.get<WorkspaceDetail>(`/workspaces/${id}`),
  updatePersona: (id: string, personaName: string, systemPrompt: string) =>
    api.patch<WorkspaceDetail>(`/workspaces/${id}`, { personaName, systemPrompt }),
  remove: (id: string) => api.delete(`/workspaces/${id}`),
};

// ── Providers ─────────────────────────────────────────
export const providerApi = {
  list: () =>
    api.get<{ id: string; provider: string; model: string; createdAt: string }[]>('/providers'),
  create: (provider: string, apiKey: string, model: string) =>
    api.post('/providers', { provider, apiKey, model }),
  remove: (id: string) => api.delete(`/providers/${id}`),
};

// ── Documents ─────────────────────────────────────────
export const documentApi = {
  list: (workspaceId: string) =>
    api.get<
      { id: string; filename: string; status: string; fileSize: number; createdAt: string }[]
    >(`/documents?workspaceId=${workspaceId}`),
  upload: (workspaceId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/documents/upload?workspaceId=${workspaceId}`, form);
  },
  remove: (id: string, workspaceId: string) =>
    api.delete(`/documents/${id}?workspaceId=${workspaceId}`),
  statusUrl: (id: string, workspaceId: string) =>
    `${BASE}/documents/${id}/status?workspaceId=${workspaceId}`,
};

// ── Chat ──────────────────────────────────────────────
export const chatApi = {
  sessions: (workspaceId: string) =>
    api.get<{ id: string; createdAt: string }[]>(`/chat/sessions?workspaceId=${workspaceId}`),
  messages: (sessionId: string) =>
    api.get<
      {
        id: string;
        role: 'user' | 'assistant';
        content: string;
        citations: {
          chunkId: string;
          documentId: string;
          filename: string;
          excerpt: string;
          chunkIndex: number;
        }[];
        createdAt: string;
      }[]
    >(`/chat/sessions/${sessionId}/messages`),
  queryUrl: () => `${BASE}/chat/query`,
  queryHeaders: () => {
    const token = typeof window !== 'undefined'
      ? useAuthStore.getState().accessToken
      : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  },
};
