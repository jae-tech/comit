'use client';

import { useState } from 'react';
import {
  useProviders,
  useProviderModels,
  useCreateProvider,
  useRemoveProvider,
} from '@/lib/queries';
import { AuthGuard } from '@/components/auth-guard';
import { AppHeader, CONTENT_WIDTH } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, CheckCircle, KeyRound, RefreshCw } from 'lucide-react';

const PROVIDERS = ['openai', 'anthropic', 'gemini'] as const;

function ProviderPage() {
  const [providerType, setProviderType] = useState<string>('openai');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data: providers = [] } = useProviders();
  const registeredForType = providers.find((p) => p.provider === providerType);

  const {
    data: models = [],
    isFetching: modelsLoading,
    refetch: refetchModels,
  } = useProviderModels(providerType, !!registeredForType);

  const createProvider = useCreateProvider();
  const removeProvider = useRemoveProvider();

  function handleProviderChange(p: string) {
    setProviderType(p);
    setModel('');
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await createProvider.mutateAsync({ provider: providerType, apiKey, model });
      setApiKey('');
      setSuccess('API Key가 등록되었습니다.');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(
        status === 422
          ? 'API Key 검증에 실패했습니다. 키를 확인해주세요.'
          : '등록에 실패했습니다.',
      );
    }
  }

  async function handleRemove(id: string) {
    await removeProvider.mutateAsync(id);
  }

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <AppHeader backHref="/" title="API 설정" />

      <main className={`${CONTENT_WIDTH} py-8`}>
        <p className="mb-8 text-sm text-stone-500 leading-relaxed">
          BYOK(Bring Your Own Key) — API 비용은 직접 부담합니다.{' '}
          <span className="text-stone-400">키는 AES-256-GCM으로 암호화되어 저장됩니다.</span>
        </p>

        {/* 등록된 프로바이더 */}
        {providers.length > 0 && (
          <div className="mb-8 flex flex-col gap-3">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">
              등록된 Provider
            </p>
            {providers.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md bg-stone-50 border border-stone-200 flex items-center justify-center">
                    <KeyRound className="h-3.5 w-3.5 text-stone-400" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-stone-900 capitalize">
                      {p.provider}
                    </span>
                    <span className="ml-2 text-xs text-stone-400 font-mono">{p.model}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(p.id)}
                  className="text-stone-300 hover:text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* 새 프로바이더 추가 */}
        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-5 rounded-lg border border-stone-200 bg-white p-6 shadow-sm"
        >
          <p className="text-sm font-medium text-stone-700">새 Provider 추가</p>

          <div className="flex gap-1.5">
            {PROVIDERS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleProviderChange(p)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  providerType === p
                    ? 'bg-stone-900 text-white'
                    : 'border border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-700'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-stone-600">API Key</label>
              <Input
                type="password"
                placeholder={
                  providerType === 'openai'
                    ? 'sk-...'
                    : providerType === 'anthropic'
                      ? 'sk-ant-...'
                      : 'AI...'
                }
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-stone-600">기본 모델</label>
                {registeredForType && (
                  <button
                    type="button"
                    onClick={() => refetchModels()}
                    className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors"
                  >
                    <RefreshCw className={`h-3 w-3 ${modelsLoading ? 'animate-spin' : ''}`} />
                    새로고침
                  </button>
                )}
              </div>

              {registeredForType && models.length > 0 ? (
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-stone-300 bg-white px-3 py-1 text-sm text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700/20 focus-visible:border-blue-700 transition-colors"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              ) : modelsLoading ? (
                <div className="flex h-9 items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 text-xs text-stone-400">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  모델 목록 불러오는 중...
                </div>
              ) : (
                <Input
                  type="text"
                  placeholder={
                    providerType === 'openai'
                      ? 'gpt-4o-mini'
                      : providerType === 'anthropic'
                        ? 'claude-sonnet-4-5'
                        : 'gemini-2.5-flash'
                  }
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  required
                />
              )}
              <p className="text-xs text-stone-400">
                {registeredForType
                  ? '등록된 API 키로 실시간 조회한 모델 목록입니다.'
                  : 'API 키 등록 후 실시간으로 사용 가능한 모델 목록이 표시됩니다.'}
              </p>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-md border border-red-100">
              {error}
            </p>
          )}
          {success && (
            <p className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-3 py-2 rounded-md border border-green-100">
              <CheckCircle className="h-3.5 w-3.5" />
              {success}
            </p>
          )}

          <div className="flex flex-col gap-1">
            <Button type="submit" disabled={createProvider.isPending}>
              {createProvider.isPending ? '검증 중...' : '등록'}
            </Button>
            <p className="text-xs text-stone-400 text-center">
              등록 시 API Key 유효성을 실시간으로 검증합니다.
            </p>
          </div>
        </form>
      </main>
    </div>
  );
}

export default function ProviderSettingsPage() {
  return (
    <AuthGuard>
      <ProviderPage />
    </AuthGuard>
  );
}
