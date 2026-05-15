'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { workspaceApi, providerApi } from '@/lib/api';
import { AuthGuard } from '@/components/auth-guard';
import { AppHeader, CONTENT_WIDTH } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, Check, KeyRound } from 'lucide-react';

const PERSONA_TEMPLATES = [
  {
    name: '법률 문서 전문가',
    prompt:
      'You are a legal document expert. Answer questions about legal documents with precision and cite relevant clauses. Always note when something requires professional legal advice. Respond in the same language as the user.',
  },
  {
    name: '기술 문서 도우미',
    prompt:
      'You are a technical documentation assistant. Answer technical questions clearly, provide code examples when relevant, and explain complex concepts step by step. Respond in the same language as the user.',
  },
  {
    name: '고객 지원 봇',
    prompt:
      'You are a friendly customer support assistant. Answer questions helpfully and concisely based on the provided documents. If you cannot find the answer, suggest contacting support. Respond in the same language as the user.',
  },
];

const DEFAULT_PROMPT =
  "You are a helpful assistant that answers questions based on the provided document context.\nAlways cite your sources. If the answer cannot be found in the context, say so clearly.\nRespond in the same language as the user's question.";

interface RegisteredProvider {
  id: string;
  provider: string;
  model: string;
}

function SettingsPage() {
  const params = useParams<{ id: string }>();
  const workspaceId = params.id;

  const [personaName, setPersonaName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // active provider 관련
  const [registeredProviders, setRegisteredProviders] = useState<RegisteredProvider[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [providerSaving, setProviderSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      workspaceApi.get(workspaceId),
      providerApi.list(),
    ]).then(([wsRes, provRes]) => {
      setPersonaName(wsRes.data.personaName ?? '');
      setSystemPrompt(wsRes.data.systemPrompt ?? '');
      setActiveProviderId(wsRes.data.activeProviderId ?? null);
      setRegisteredProviders(provRes.data);
      setLoading(false);
    });
  }, [workspaceId]);

  function applyTemplate(template: { name: string; prompt: string }) {
    setPersonaName(template.name);
    setSystemPrompt(template.prompt);
    setSelectedTemplate(template.name);
    setSaved(false);
  }

  function handlePromptChange(value: string) {
    setSystemPrompt(value);
    setSelectedTemplate(null);
    setSaved(false);
  }

  function handleNameChange(value: string) {
    setPersonaName(value);
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await workspaceApi.updatePersona(workspaceId, personaName, systemPrompt);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.error('저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  async function handleProviderSelect(providerId: string) {
    setProviderSaving(true);
    try {
      await workspaceApi.setActiveProvider(workspaceId, providerId);
      setActiveProviderId(providerId);
      toast.success('AI 모델이 변경되었습니다.');
    } catch {
      toast.error('AI 모델 변경에 실패했습니다.');
    } finally {
      setProviderSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-stone-400 text-sm bg-[#faf9f7]">
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <AppHeader
        backHref={`/workspaces/${workspaceId}/chat`}
        title="AI 페르소나 설정"
        right={
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saved ? (
              <><Check className="h-3.5 w-3.5" />저장됨</>
            ) : (
              <><Save className="h-3.5 w-3.5" />{saving ? '저장 중...' : '저장'}</>
            )}
          </Button>
        }
      />

      <main className={`${CONTENT_WIDTH} py-8 flex flex-col gap-8`}>

        {/* AI 모델 선택 */}
        <section>
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">
            AI 모델
          </p>
          <p className="text-xs text-stone-400 mb-3">
            이 워크스페이스 채팅에 사용할 AI Provider를 선택하세요.
          </p>
          {registeredProviders.length === 0 ? (
            <div className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-400 shadow-sm">
              등록된 AI Provider가 없습니다.{' '}
              <a href="/settings/provider" className="text-stone-600 underline underline-offset-2">
                API 설정
              </a>
              에서 먼저 등록해 주세요.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {registeredProviders.map((p) => {
                const isActive = activeProviderId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => !isActive && handleProviderSelect(p.id)}
                    disabled={providerSaving}
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                      isActive
                        ? 'border-stone-900 bg-stone-900 text-white'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 shadow-sm'
                    } disabled:opacity-50`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-md border flex items-center justify-center ${
                          isActive ? 'bg-stone-800 border-stone-700' : 'bg-stone-50 border-stone-200'
                        }`}
                      >
                        <KeyRound className={`h-3.5 w-3.5 ${isActive ? 'text-stone-300' : 'text-stone-400'}`} />
                      </div>
                      <div>
                        <span className="text-sm font-medium capitalize">{p.provider}</span>
                        <span className={`ml-2 text-xs font-mono ${isActive ? 'text-stone-300' : 'text-stone-400'}`}>
                          {p.model}
                        </span>
                      </div>
                    </div>
                    {isActive && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* 템플릿 */}
        <section>
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">템플릿</p>
          <div className="flex flex-col gap-2">
            {PERSONA_TEMPLATES.map((t) => (
              <button
                key={t.name}
                onClick={() => applyTemplate(t)}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                  selectedTemplate === t.name
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 shadow-sm'
                }`}
              >
                {selectedTemplate === t.name && <Check className="h-3.5 w-3.5 shrink-0" />}
                <span className="font-medium">{t.name}</span>
              </button>
            ))}
            <button
              onClick={() => {
                setSelectedTemplate('custom');
                setPersonaName('');
                setSystemPrompt('');
                setSaved(false);
              }}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                selectedTemplate === 'custom'
                  ? 'border-stone-900 bg-stone-900 text-white'
                  : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300 shadow-sm'
              }`}
            >
              {selectedTemplate === 'custom' && <Check className="h-3.5 w-3.5 shrink-0" />}
              <span className="font-medium">직접 입력</span>
            </button>
          </div>
        </section>

        {/* 페르소나 이름 */}
        <section>
          <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
            페르소나 이름
          </label>
          <Input
            value={personaName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="예: Alice the Legal Expert"
            maxLength={100}
          />
          <p className="mt-1.5 text-xs text-stone-400">채팅 화면 상단에 표시됩니다.</p>
        </section>

        {/* 시스템 프롬프트 */}
        <section>
          <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
            시스템 프롬프트
          </label>
          <textarea
            value={systemPrompt}
            onChange={(e) => handlePromptChange(e.target.value)}
            placeholder={DEFAULT_PROMPT}
            maxLength={2000}
            rows={8}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-300 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20 resize-none leading-relaxed transition-colors"
          />
          <p className="mt-1.5 text-xs text-stone-400">
            {systemPrompt.length}/2000자 · 비워두면 기본 프롬프트가 사용됩니다.
          </p>
        </section>
      </main>
    </div>
  );
}

export default function SettingsPageWrapper() {
  return (
    <AuthGuard>
      <SettingsPage />
    </AuthGuard>
  );
}
