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
} from 'lucide-react';
import { ComitLogo } from '@/components/comit-logo';
import Link from 'next/link';

interface Doc {
  id: string;
  filename: string;
  status: string;
}

interface WorkspaceInfo {
  personaName: string | null;
  systemPrompt: string | null;
  model: string;
  documentCount: number;
}

const ADMIN_TOKEN_KEY = 'comit-demo-admin-token';

export default function DemoAdminPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [info, setInfo] = useState<WorkspaceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  // 관리자 토큰
  const [adminToken, setAdminToken] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [tokenError, setTokenError] = useState('');

  // 편집 상태
  const [editingPersona, setEditingPersona] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [personaDraft, setPersonaDraft] = useState('');
  const [promptDraft, setPromptDraft] = useState('');
  const [saving, setSaving] = useState<'persona' | 'prompt' | null>(null);
  const [saveError, setSaveError] = useState('');

  const personaInputRef = useRef<HTMLInputElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const stored = typeof window !== 'undefined'
      ? localStorage.getItem(ADMIN_TOKEN_KEY) ?? ''
      : '';
    setAdminToken(stored);
  }, []);

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

  function handleTokenSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    localStorage.setItem(ADMIN_TOKEN_KEY, tokenInput.trim());
    setAdminToken(tokenInput.trim());
    setTokenInput('');
    setTokenError('');
  }

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
    if (!adminToken) return;
    setSaving('persona');
    setSaveError('');
    try {
      const res = await demoAdminApi.updateSettings(adminToken, {
        personaName: personaDraft,
      });
      if (res.status === 403 || res.status === 401) {
        setTokenError('토큰이 올바르지 않습니다.');
        setSaving(null);
        return;
      }
      setInfo((prev) => prev ? { ...prev, personaName: personaDraft || null } : prev);
      setEditingPersona(false);
    } catch {
      setSaveError('저장 실패 — API 서버를 확인하세요.');
    } finally {
      setSaving(null);
    }
  }

  async function savePrompt() {
    if (!adminToken) return;
    setSaving('prompt');
    setSaveError('');
    try {
      const res = await demoAdminApi.updateSettings(adminToken, {
        systemPrompt: promptDraft,
      });
      if (res.status === 403 || res.status === 401) {
        setTokenError('토큰이 올바르지 않습니다.');
        setSaving(null);
        return;
      }
      setInfo((prev) => prev ? { ...prev, systemPrompt: promptDraft || null } : prev);
      setEditingPrompt(false);
    } catch {
      setSaveError('저장 실패 — API 서버를 확인하세요.');
    } finally {
      setSaving(null);
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

  const isAdmin = !!adminToken;

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

        {/* 관리자 토큰 */}
        <section className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-stone-400" />
              <h2 className="text-xs font-semibold text-stone-600 uppercase tracking-wide">관리자 인증</h2>
            </div>
            {isAdmin && (
              <span className="flex items-center gap-1 text-[10px] text-green-600">
                <CheckCircle className="h-3 w-3" /> 인증됨
              </span>
            )}
          </div>
          {isAdmin ? (
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-stone-500">설정을 편집할 수 있습니다.</span>
              <button
                onClick={() => {
                  localStorage.removeItem(ADMIN_TOKEN_KEY);
                  setAdminToken('');
                }}
                className="text-xs text-stone-400 hover:text-red-500 transition-colors"
              >
                토큰 제거
              </button>
            </div>
          ) : (
            <form onSubmit={handleTokenSubmit} className="px-4 py-3 flex gap-2">
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="DEMO_ADMIN_TOKEN 입력"
                className="flex-1 text-xs rounded-lg border border-stone-200 px-3 py-2 outline-none focus:border-stone-400 bg-stone-50"
              />
              <button
                type="submit"
                className="rounded-lg bg-stone-900 px-3 py-2 text-xs font-medium text-white hover:bg-stone-700 transition-colors"
              >
                확인
              </button>
            </form>
          )}
          {tokenError && (
            <p className="px-4 pb-3 text-xs text-red-500">{tokenError}</p>
          )}
        </section>

        {/* 문서 목록 */}
        <section className="rounded-xl border border-stone-200 bg-white overflow-hidden">
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

        {/* AI 설정 */}
        <section className="rounded-xl border border-stone-200 bg-white overflow-hidden">
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
                      className="flex-1 text-xs rounded-lg border border-stone-300 px-3 py-1.5 outline-none focus:border-stone-500 bg-white"
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
                    {isAdmin && (
                      <button
                        onClick={startEditPersona}
                        className="text-stone-300 hover:text-stone-600 transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
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
                    className="text-xs rounded-lg border border-stone-300 px-3 py-2 outline-none focus:border-stone-500 bg-white resize-none leading-relaxed"
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
                    {isAdmin && (
                      <button
                        onClick={startEditPrompt}
                        className="text-stone-300 hover:text-stone-600 transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
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
        <section className="rounded-xl border border-stone-200 bg-stone-900 px-6 py-6 flex flex-col gap-3">
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
