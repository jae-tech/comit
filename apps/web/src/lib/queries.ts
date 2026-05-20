import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  workspaceApi,
  providerApi,
  documentApi,
  chatApi,
  usageApi,
  adminApi,
  type WorkspaceDetail,
} from '@/lib/api';

// ── Query Keys ────────────────────────────────────────
export const queryKeys = {
  workspaces: ['workspaces'] as const,
  workspace: (id: string) => ['workspaces', id] as const,
  providers: ['providers'] as const,
  providerModels: (provider: string) => ['providers', 'models', provider] as const,
  documents: (workspaceId: string) => ['documents', workspaceId] as const,
  chatSessions: (workspaceId: string) => ['chat', 'sessions', workspaceId] as const,
  chatMessages: (sessionId: string) => ['chat', 'messages', sessionId] as const,
  usageSummary: ['usage', 'summary'] as const,
  usageDaily: (days: number) => ['usage', 'daily', days] as const,
  usageSessions: (workspaceId?: string, limit?: number) =>
    ['usage', 'sessions', workspaceId, limit] as const,
  adminStats: ['admin', 'stats'] as const,
};

// ── Workspaces ────────────────────────────────────────
export function useWorkspaces() {
  return useQuery({
    queryKey: queryKeys.workspaces,
    queryFn: () => workspaceApi.list().then((r) => r.data),
  });
}

export function useWorkspace(id: string) {
  return useQuery({
    queryKey: queryKeys.workspace(id),
    queryFn: () => workspaceApi.get(id).then((r) => r.data),
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => workspaceApi.create(name).then((r) => r.data),
    onSuccess: (newWs) => {
      qc.setQueryData<WorkspaceDetail[]>(queryKeys.workspaces, (prev = []) => [
        ...prev,
        newWs,
      ]);
    },
  });
}

export function useRemoveWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workspaceApi.remove(id),
    onSuccess: (_, id) => {
      qc.setQueryData<WorkspaceDetail[]>(queryKeys.workspaces, (prev = []) =>
        prev.filter((w) => w.id !== id),
      );
    },
  });
}

export function useUpdateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      personaName?: string;
      systemPrompt?: string;
    }) => workspaceApi.updateWorkspace(id, data).then((r) => r.data),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.workspace(updated.id), updated);
      qc.setQueryData<WorkspaceDetail[]>(queryKeys.workspaces, (prev = []) =>
        prev.map((w) => (w.id === updated.id ? { ...w, name: updated.name } : w)),
      );
    },
  });
}

/** @deprecated useUpdateWorkspace 사용 */
export const useUpdatePersona = useUpdateWorkspace;

export function useSetActiveProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, providerId }: { id: string; providerId: string }) =>
      workspaceApi.setActiveProvider(id, providerId).then((r) => r.data),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.workspace(updated.id), updated);
    },
  });
}

// ── Providers ─────────────────────────────────────────
export function useProviders() {
  return useQuery({
    queryKey: queryKeys.providers,
    queryFn: () => providerApi.list().then((r) => r.data),
  });
}

export function useProviderModels(provider: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.providerModels(provider),
    queryFn: () => providerApi.models(provider).then((r) => r.data.models),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useCreateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      provider,
      apiKey,
      model,
    }: {
      provider: string;
      apiKey: string;
      model: string;
    }) => providerApi.create(provider, apiKey, model).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.providers });
    },
  });
}

export function useRemoveProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => providerApi.remove(id),
    onSuccess: (_, id) => {
      qc.setQueryData<{ id: string; provider: string; model: string; createdAt: string }[]>(
        queryKeys.providers,
        (prev = []) => prev.filter((p) => p.id !== id),
      );
    },
  });
}

// ── Documents ─────────────────────────────────────────
export function useDocuments(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.documents(workspaceId),
    queryFn: () => documentApi.list(workspaceId).then((r) => r.data),
  });
}

export function useUploadDocument(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => documentApi.upload(workspaceId, file),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.documents(workspaceId) });
    },
  });
}

export function useRemoveDocument(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => documentApi.remove(id, workspaceId),
    onSuccess: (_, id) => {
      qc.setQueryData<
        { id: string; filename: string; status: string; fileSize: number; createdAt: string }[]
      >(queryKeys.documents(workspaceId), (prev = []) => prev.filter((d) => d.id !== id));
    },
  });
}

// ── Chat ──────────────────────────────────────────────
export function useChatSessions(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.chatSessions(workspaceId),
    queryFn: () => chatApi.sessions(workspaceId).then((r) => r.data),
  });
}

export function useChatMessages(sessionId: string | null) {
  return useQuery({
    queryKey: queryKeys.chatMessages(sessionId ?? ''),
    queryFn: () => chatApi.messages(sessionId!).then((r) => r.data),
    enabled: !!sessionId,
  });
}

export function useDeleteChatSession(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => chatApi.deleteSession(sessionId),
    onSuccess: (_, sessionId) => {
      qc.setQueryData<{ id: string; createdAt: string }[]>(
        queryKeys.chatSessions(workspaceId),
        (prev = []) => prev.filter((s) => s.id !== sessionId),
      );
    },
  });
}

// ── Usage ─────────────────────────────────────────────
export function useUsageSummary() {
  return useQuery({
    queryKey: queryKeys.usageSummary,
    queryFn: () => usageApi.summary().then((r) => r.data),
  });
}

export function useUsageDaily(days = 30) {
  return useQuery({
    queryKey: queryKeys.usageDaily(days),
    queryFn: () => usageApi.daily(days).then((r) => r.data),
  });
}

export function useUsageSessions(workspaceId?: string, limit = 20) {
  return useQuery({
    queryKey: queryKeys.usageSessions(workspaceId, limit),
    queryFn: () => usageApi.sessions(workspaceId, limit).then((r) => r.data),
  });
}

// ── Admin ─────────────────────────────────────────────
export function useAdminStats() {
  return useQuery({
    queryKey: queryKeys.adminStats,
    queryFn: () => adminApi.stats().then((r) => r.data),
  });
}
