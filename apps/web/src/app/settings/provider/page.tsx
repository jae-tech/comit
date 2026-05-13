'use client';

import { useState, useEffect } from 'react';
import { providerApi } from '@/lib/api';
import { AuthGuard } from '@/components/auth-guard';
import { AppHeader, CONTENT_WIDTH } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, CheckCircle, KeyRound } from 'lucide-react';

interface Provider {
  id: string;
  provider: string;
  model: string;
  createdAt: string;
}

const MODEL_OPTIONS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  anthropic: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5-20251001'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'],
};

function ProviderPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerType, setProviderType] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    providerApi.list().then((r) => setProviders(r.data));
  }, []);

  function handleProviderChange(p: string) {
    setProviderType(p);
    setModel(MODEL_OPTIONS[p][0]);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await providerApi.create(providerType, apiKey, model);
      setProviders((prev) => [...prev, res.data as Provider]);
      setApiKey('');
      setSuccess('API Key가 등록되었습니다.');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status === 422 ? 'API Key 검증에 실패했습니다. 키를 확인해주세요.' : '등록에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(id: string) {
    await providerApi.remove(id);
    setProviders((prev) => prev.filter((p) => p.id !== id));
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
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">등록된 Provider</p>
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
                    <span className="text-sm font-medium text-stone-900 capitalize">{p.provider}</span>
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
        <form onSubmit={handleAdd} className="flex flex-col gap-5 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-stone-700">새 Provider 추가</p>

          <div className="flex gap-1.5">
            {Object.keys(MODEL_OPTIONS).map((p) => (
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
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-stone-600">모델</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="flex h-9 w-full rounded-md border border-stone-300 bg-white px-3 py-1 text-sm text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700/20 focus-visible:border-blue-700 transition-colors"
              >
                {MODEL_OPTIONS[providerType].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
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
            <Button type="submit" disabled={loading}>
              {loading ? '검증 중...' : '등록'}
            </Button>
            <p className="text-xs text-stone-400 text-center">등록 시 API Key 유효성을 실시간으로 검증합니다.</p>
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
