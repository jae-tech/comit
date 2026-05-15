'use client';

import { useState, useEffect, useRef } from 'react';
import { demoApi, demoAdminApi } from '@/lib/api';
import {
  Loader2,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Bot,
  Database,
  Zap,
  MessageSquare,
  Info,
  Pencil,
  Check,
  X as XIcon,
  Lock,
  Plus,
  Trash2,
  UserCircle2,
} from 'lucide-react';
import { ComitLogo } from '@/components/comit-logo';
import Link from 'next/link';

interface Doc {
  id: string;
  filename: string;
  status: string;
}

interface PersonaEntry {
  id: string;
  name: string;
  prompt: string;
}

interface WorkspaceInfo {
  personaName: string | null;
  systemPrompt: string | null;
  model: string;
  documentCount: number;
  personas: PersonaEntry[];
}

export default function DemoAdminPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [info, setInfo] = useState<WorkspaceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  // 편집 상태
  const [editingPersona, setEditingPersona] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [personaDraft, setPersonaDraft] = useState('');
  const [promptDraft, setPromptDraft] = useState('');
  const [saving, setSaving] = useState<'persona' | 'prompt' | null>(null);
  const [saveError, setSaveError] = useState('');

  const personaInputRef = useRef<HTMLInputElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

  // 페르소나 목록 상태
  const [activatingPersonaId, setActivatingPersonaId] = useState<string | null>(null);
  const [removingPersonaId, setRemovingPersonaId] = useState<string | null>(null);
  const [showAddPersona, setShowAddPersona] = useState(false);
  const [newPersonaName, setNewPersonaName] = useState('');
  const [newPersonaPrompt, setNewPersonaPrompt] = useState('');
  const [addingPersona, setAddingPersona] = useState(false);
  const [personaError, setPersonaError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch(demoApi.docsUrl()),
      fetch(demoApi.infoUrl()),
    ]).then(async ([docsRes, infoRes]) => {
      if (!docsRes.ok || !infoRes.ok) {
        setUnavailable(true);
        return;
      }
      const [docsData, infoData]: [Doc[], WorkspaceInfo] = await Promise.all([
        docsRes.json(),
        infoRes.json(),
      ]);
      setDocs(docsData);
      setInfo(infoData);
    }).catch(() => {
      setUnavailable(true);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (editingPersona) personaInputRef.current?.focus();
  }, [editingPersona]);

  useEffect(() => {
    if (editingPrompt) promptTextareaRef.current?.focus();
  }, [editingPrompt]);

  function startEditPersona() {
    setPersonaDraft(info?.personaName ?? '');
    setEditingPersona(true);
    setSaveError('');
  }

  function startEditPrompt() {
    setPromptDraft(info?.systemPrompt ?? '');
    setEditingPrompt(true);
    setSaveError('');
  }

  async function savePersona() {
    setSaving('persona');
    setSaveError('');
    try {
      const res = await demoAdminApi.updateSettings({ personaName: personaDraft });
      if (!res.ok) { setSaveError('저장 실패 — API 서버를 확인하세요.'); return; }
      setInfo((prev) => prev ? { ...prev, personaName: personaDraft || null } : prev);
      setEditingPersona(false);
    } catch {
      setSaveError('저장 실패 — API 서버를 확인하세요.');
    } finally {
      setSaving(null);
    }
  }

  async function savePrompt() {
    setSaving('prompt');
    setSaveError('');
    try {
      const res = await demoAdminApi.updateSettings({ systemPrompt: promptDraft });
      if (!res.ok) { setSaveError('저장 실패 — API 서버를 확인하세요.'); return; }
      setInfo((prev) => prev ? { ...prev, systemPrompt: promptDraft || null } : prev);
      setEditingPrompt(false);
    } catch {
      setSaveError('저장 실패 — API 서버를 확인하세요.');
    } finally {
      setSaving(null);
    }
  }

  async function handleActivatePersona(personaId: string) {
    setActivatingPersonaId(personaId);
    setPersonaError('');
    try {
      const res = await demoAdminApi.activatePersona(personaId);
      if (!res.ok) { setPersonaError('활성화 실패 — 다시 시도해주세요.'); return; }
      const target = info?.personas.find((p) => p.id === personaId);
      if (target) {
        setInfo((prev) => prev ? { ...prev, personaName: target.name, systemPrompt: target.prompt } : prev);
      }
    } catch {
      setPersonaError('활성화 실패 — API 서버를 확인하세요.');
    } finally {
      setActivatingPersonaId(null);
    }
  }

  async function handleRemovePersona(personaId: string) {
    setRemovingPersonaId(personaId);
    setPersonaError('');
    try {
      const res = await demoAdminApi.removePersona(personaId);
      if (!res.ok) { setPersonaError('삭제 실패 — 다시 시도해주세요.'); return; }
      setInfo((prev) => prev ? { ...prev, personas: prev.personas.filter((p) => p.id !== personaId) } : prev);
    } catch {
      setPersonaError('삭제 실패 — API 서버를 확인하세요.');
    } finally {
      setRemovingPersonaId(null);
    }
  }

  async function handleAddPersona(e: React.FormEvent) {
    e.preventDefault();
    if (!newPersonaName.trim() || !newPersonaPrompt.trim()) return;
    setAddingPersona(true);
    setPersonaError('');
    try {
      const res = await demoAdminApi.addPersona({
        name: newPersonaName.trim(),
        prompt: newPersonaPrompt.trim(),
      });
      if (!res.ok) { setPersonaError('추가 실패 — 다시 시도해주세요.'); return; }
      const created = await res.json() as PersonaEntry;
      setInfo((prev) => prev ? { ...prev, personas: [...prev.personas, created] } : prev);
      setNewPersonaName('');
      setNewPersonaPrompt('');
      setShowAddPersona(false);
    } catch {
      setPersonaError('추가 실패 — API 서버를 확인하세요.');
    } finally {
      setAddingPersona(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#faf9f7]">
        <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#faf9f7]">
        <p className="text-xs text-stone-400">데모가 아직 설정되지 않았습니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* 헤더 */}
      <header className="fixed top-0 inset-x-0 z-40 bg-white border-b border-stone-200 px-4 h-12 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ComitLogo size={24} color="#1d4ed8" />
          <span className="text-sm font-semibold text-stone-900 tracking-tight">Comit 데모</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/demo"
            className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-700 transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            챗봇
          </Link>
          <Link
            href="/demo/admin"
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-900 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-900 transition-colors"
          >
            <Info className="h-3.5 w-3.5" />
            어드민
          </Link>
        </div>
      </header>

      <div className="px-4 py-10 pt-20">
      <div className="mx-auto max-w-2xl flex flex-col gap-8">
        {/* 페이지 제목 */}
        <div>
          <h1 className="text-lg font-semibold text-stone-900">Comit 데모 — 어떻게 작동하나요?</h1>
          <p className="mt-1 text-sm text-stone-400">
            이 데모는 실제 Comit 워크스페이스 위에서 실행됩니다. 아래 설정이 지금 데모 챗봇에 적용되어 있습니다.
          </p>
        </div>

        {/* 문서 목록 */}
        <section className="rounded-lg border border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 flex items-center gap-2">
            <Database className="h-3.5 w-3.5 text-stone-400" />
            <h2 className="text-xs font-semibold text-stone-600 uppercase tracking-wide">
              인덱싱된 문서 {docs.length > 0 && `(${docs.length}개)`}
            </h2>
          </div>
          {docs.length === 0 ? (
            <p className="px-4 py-6 text-xs text-stone-400 text-center">등록된 문서가 없습니다.</p>
          ) : (
            <ul className="divide-y divide-stone-50">
              {docs.map((doc) => (
                <li key={doc.id} className="flex items-center gap-3 px-4 py-3">
                  <FileText className="h-3.5 w-3.5 text-stone-300 shrink-0" />
                  <span className="flex-1 text-xs text-stone-700 truncate">{doc.filename}</span>
                  {doc.status === 'ready' && (
                    <span className="flex items-center gap-1 text-[10px] text-green-600 shrink-0">
                      <CheckCircle className="h-3 w-3" /> 준비됨
                    </span>
                  )}
                  {doc.status === 'processing' && (
                    <span className="flex items-center gap-1 text-[10px] text-blue-500 shrink-0">
                      <Loader2 className="h-3 w-3 animate-spin" /> 처리 중
                    </span>
                  )}
                  {doc.status === 'failed' && (
                    <span className="flex items-center gap-1 text-[10px] text-red-400 shrink-0" title="임베딩 실패 — 검색에 사용되지 않습니다">
                      <XCircle className="h-3 w-3" /> 실패 (검색 불가)
                    </span>
                  )}
                  {doc.status === 'pending' && (
                    <span className="flex items-center gap-1 text-[10px] text-stone-400 shrink-0">
                      <Clock className="h-3 w-3" /> 대기 중
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 페르소나 프리셋 */}
        <section className="rounded-lg border border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCircle2 className="h-3.5 w-3.5 text-stone-400" />
              <h2 className="text-xs font-semibold text-stone-600 uppercase tracking-wide">
                페르소나 프리셋 {info && info.personas.length > 0 && `(${info.personas.length}개)`}
              </h2>
            </div>
            <button
              onClick={() => { setShowAddPersona((v) => !v); setPersonaError(''); }}
              className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 transition-colors"
            >
              <Plus className="h-3 w-3" />
              추가
            </button>
          </div>

          {/* 페르소나 추가 폼 */}
          {showAddPersona && (
            <form onSubmit={handleAddPersona} className="px-4 py-3 border-b border-stone-100 flex flex-col gap-2 bg-stone-50">
              <span className="text-xs font-medium text-stone-600">새 페르소나</span>
              <input
                type="text"
                value={newPersonaName}
                onChange={(e) => setNewPersonaName(e.target.value)}
                maxLength={100}
                placeholder="이름 (예: 고객지원봇)"
                className="text-xs rounded-md border border-stone-300 px-3 py-1.5 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 bg-white transition-colors"
                required
              />
              <textarea
                value={newPersonaPrompt}
                onChange={(e) => setNewPersonaPrompt(e.target.value)}
                maxLength={4000}
                rows={4}
                placeholder="시스템 프롬프트 (예: 당신은 친절한 고객지원 담당자입니다.)"
                className="text-xs rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 bg-white resize-none leading-relaxed transition-colors"
                required
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-stone-400">{newPersonaPrompt.length} / 4000</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowAddPersona(false); setNewPersonaName(''); setNewPersonaPrompt(''); }}
                    className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-500 hover:text-stone-800 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={addingPersona || !newPersonaName.trim() || !newPersonaPrompt.trim()}
                    className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs text-white hover:bg-stone-700 transition-colors disabled:opacity-40 flex items-center gap-1.5"
                  >
                    {addingPersona && <Loader2 className="h-3 w-3 animate-spin" />}
                    추가
                  </button>
                </div>
              </div>
            </form>
          )}

          {!info || info.personas.length === 0 ? (
            <p className="px-4 py-6 text-xs text-stone-400 text-center">
              + 추가 버튼으로 페르소나 프리셋을 만들어보세요.
            </p>
          ) : (
            <ul className="divide-y divide-stone-50">
              {info.personas.map((persona) => {
                const isActive = info.personaName === persona.name && info.systemPrompt === persona.prompt;
                const isDefault = persona.id.startsWith('00000000-0000-0000-0000-');
                return (
                  <li key={persona.id} className={`px-4 py-3 flex flex-col gap-1.5 ${isActive ? 'bg-blue-50/40' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isActive && (
                          <span className="flex items-center gap-0.5 text-[10px] text-blue-600 font-medium shrink-0">
                            <CheckCircle className="h-3 w-3" /> 활성
                          </span>
                        )}
                        <span className="text-xs font-medium text-stone-800">{persona.name}</span>
                        {isDefault && (
                          <span className="text-[10px] text-stone-300">기본</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isActive && (
                          <button
                            onClick={() => handleActivatePersona(persona.id)}
                            disabled={activatingPersonaId === persona.id}
                            className="rounded-lg border border-stone-200 px-2 py-1 text-[10px] text-stone-600 hover:bg-stone-900 hover:text-white hover:border-stone-900 transition-colors disabled:opacity-40 flex items-center gap-1"
                          >
                            {activatingPersonaId === persona.id ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            ) : (
                              <Check className="h-2.5 w-2.5" />
                            )}
                            적용
                          </button>
                        )}
                        {!isDefault && (
                          <button
                            onClick={() => handleRemovePersona(persona.id)}
                            disabled={removingPersonaId === persona.id}
                            className="rounded-lg border border-stone-100 p-1 text-stone-300 hover:text-red-500 hover:border-red-200 transition-colors disabled:opacity-40"
                            title="삭제"
                          >
                            {removingPersonaId === persona.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-stone-500 leading-relaxed line-clamp-2 bg-stone-50 rounded px-2 py-1 border border-stone-100">
                      {persona.prompt}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}

          {personaError && (
            <p className="px-4 pb-3 text-xs text-red-500">{personaError}</p>
          )}
        </section>

        {/* AI 설정 */}
        <section className="rounded-lg border border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 flex items-center gap-2">
            <Bot className="h-3.5 w-3.5 text-stone-400" />
            <h2 className="text-xs font-semibold text-stone-600 uppercase tracking-wide">AI 설정</h2>
          </div>
          <div className="divide-y divide-stone-50">

            {/* 모델 — 읽기 전용 */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-stone-500">모델</span>
                <span className="flex items-center gap-0.5 text-[10px] text-stone-400">
                  <Lock className="h-2.5 w-2.5" />
                  고정
                </span>
              </div>
              <span className="text-xs font-mono bg-stone-50 border border-stone-200 rounded px-2 py-0.5 text-stone-700">
                {info?.model ?? '—'}
              </span>
            </div>

            {/* 페르소나 이름 */}
            <div className="px-4 py-3">
              {editingPersona ? (
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-stone-500">페르소나 이름</span>
                  <div className="flex gap-2">
                    <input
                      ref={personaInputRef}
                      type="text"
                      value={personaDraft}
                      onChange={(e) => setPersonaDraft(e.target.value)}
                      maxLength={100}
                      placeholder="예: Comit AI"
                      className="flex-1 text-xs rounded-md border border-stone-300 px-3 py-1.5 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 bg-white transition-colors"
                    />
                    <button
                      onClick={savePersona}
                      disabled={saving === 'persona'}
                      className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs text-white hover:bg-stone-700 transition-colors disabled:opacity-40 flex items-center gap-1"
                    >
                      {saving === 'persona' ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                    </button>
                    <button
                      onClick={() => setEditingPersona(false)}
                      disabled={saving === 'persona'}
                      className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-500 hover:text-stone-800 transition-colors disabled:opacity-40"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-stone-500">페르소나 이름</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-700">
                      {info?.personaName ?? '기본값'}
                    </span>
                    <button
                      onClick={startEditPersona}
                      className="text-stone-300 hover:text-stone-600 transition-colors"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 시스템 프롬프트 */}
            <div className="px-4 py-3">
              {editingPrompt ? (
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-stone-500">시스템 프롬프트</span>
                  <textarea
                    ref={promptTextareaRef}
                    value={promptDraft}
                    onChange={(e) => setPromptDraft(e.target.value)}
                    maxLength={4000}
                    rows={6}
                    placeholder="AI의 역할과 행동 지침을 입력하세요."
                    className="text-xs rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 bg-white resize-none leading-relaxed transition-colors"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-stone-400">{promptDraft.length} / 4000</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingPrompt(false)}
                        disabled={saving === 'prompt'}
                        className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-500 hover:text-stone-800 transition-colors disabled:opacity-40"
                      >
                        취소
                      </button>
                      <button
                        onClick={savePrompt}
                        disabled={saving === 'prompt'}
                        className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs text-white hover:bg-stone-700 transition-colors disabled:opacity-40 flex items-center gap-1.5"
                      >
                        {saving === 'prompt' && <Loader2 className="h-3 w-3 animate-spin" />}
                        저장
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-stone-500">시스템 프롬프트</span>
                    <button
                      onClick={startEditPrompt}
                      className="text-stone-300 hover:text-stone-600 transition-colors"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                  {info?.systemPrompt ? (
                    <p className="text-xs text-stone-600 leading-relaxed bg-stone-50 rounded-lg px-3 py-2 border border-stone-100 whitespace-pre-wrap">
                      {info.systemPrompt}
                    </p>
                  ) : (
                    <span className="text-xs text-stone-400 italic">미설정</span>
                  )}
                </div>
              )}
            </div>

          </div>
          {saveError && (
            <p className="px-4 pb-3 text-xs text-red-500">{saveError}</p>
          )}
        </section>

        {/* 직접 만들어보기 CTA */}
        <section className="rounded-lg border border-stone-200 bg-stone-900 px-6 py-6 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-400" />
            <span className="text-sm font-semibold text-white">직접 만들어보세요</span>
          </div>
          <p className="text-xs text-stone-400 leading-relaxed">
            내 문서를 업로드하고, 내 AI API 키를 연결하면 지금 보시는 것과 동일한 RAG 챗봇을 바로 만들 수 있습니다.
          </p>
          <a
            href="/register"
            className="self-start rounded-lg bg-white px-4 py-2 text-xs font-medium text-stone-900 hover:bg-stone-100 transition-colors"
          >
            무료로 시작하기 →
          </a>
        </section>
      </div>
      </div>
    </div>
  );
}
