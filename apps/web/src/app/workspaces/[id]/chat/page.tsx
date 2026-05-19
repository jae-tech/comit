'use client';

import { useState, useRef, useCallback, useEffect, Suspense, type KeyboardEvent } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { chatApi } from '@/lib/api';
import { useWorkspace, useDocuments, useChatSessions, queryKeys } from '@/lib/queries';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AuthGuard } from '@/components/auth-guard';
import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Send, FileText, Loader2, Settings, MessageSquare, Plus, Clock, CheckCircle, XCircle, Trash2, Search, ChevronDown } from 'lucide-react';
import { useStreamChat, type Citation } from '@/hooks/useStreamChat';

function ChatPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const workspaceId = params.id;
  const qc = useQueryClient();

  const [sessionId, setSessionId] = useState<string | undefined>(
    searchParams.get('session') ?? undefined,
  );
  const [input, setInput] = useState('');
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isNewSessionRef = useRef(false);
  const userScrolledUpRef = useRef(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const { data: workspace } = useWorkspace(workspaceId);
  const { data: docs = [] } = useDocuments(workspaceId);
  const { data: sessions = [] } = useChatSessions(workspaceId);

  const personaName = workspace?.personaName ?? null;

  const setSessionIdWithUrl = useCallback((sid: string | undefined) => {
    setSessionId(sid);
    if (sid) isNewSessionRef.current = false;
    const url = new URL(window.location.href);
    if (sid) {
      url.searchParams.set('session', sid);
    } else {
      url.searchParams.delete('session');
    }
    router.replace(url.pathname + url.search, { scroll: false });
  }, [router]);

  const refreshSessions = useCallback(async () => {
    return await qc.fetchQuery<{ id: string; createdAt: string }[]>({
      queryKey: queryKeys.chatSessions(workspaceId),
      queryFn: () => chatApi.sessions(workspaceId).then((r) => r.data),
    });
  }, [qc, workspaceId]);

  const { messages, setMessages, streaming, sendMessage } = useStreamChat({
    workspaceId,
    sessionId,
    onSessionCreated: setSessionIdWithUrl,
    onSessionsRefresh: refreshSessions,
  });

  // 초기 세션 복원 (URL param 또는 최신 세션)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current || sessions.length === 0) return;
    initializedRef.current = true;
    const targetId = searchParams.get('session') ?? undefined;
    if (targetId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSessionId(targetId);
      chatApi.messages(targetId).then((r) => setMessages(r.data));
    } else if (!isNewSessionRef.current) {
      const latest = sessions[sessions.length - 1];
      setSessionIdWithUrl(latest.id);
      chatApi.messages(latest.id).then((r) => setMessages(r.data));
    }
  }, [sessions, searchParams, setSessionIdWithUrl, setMessages]);

  function startNewSession() {
    isNewSessionRef.current = true;
    setSessionIdWithUrl(undefined);
    setMessages([]);
    setSidebarOpen(false);
  }

  async function switchSession(sid: string) {
    setSessionIdWithUrl(sid);
    const msgs = await chatApi.messages(sid);
    setMessages(msgs.data.map((m) => ({ ...m })));
    setSidebarOpen(false);
  }

  function requestDeleteSession(e: React.MouseEvent, sid: string) {
    e.stopPropagation();
    setPendingDeleteId(sid);
  }

  async function confirmDeleteSession(e: React.MouseEvent, sid: string) {
    e.stopPropagation();
    setPendingDeleteId(null);
    try {
      await chatApi.deleteSession(sid);
      qc.setQueryData<{ id: string; createdAt: string }[]>(
        queryKeys.chatSessions(workspaceId),
        (prev = []) => prev.filter((s) => s.id !== sid),
      );
      if (sid === sessionId) startNewSession();
      toast.success('대화가 삭제되었습니다.');
    } catch {
      toast.error('삭제에 실패했습니다. 다시 시도해 주세요.');
    }
  }

  function cancelDeleteSession(e: React.MouseEvent) {
    e.stopPropagation();
    setPendingDeleteId(null);
  }

  function scrollToBottom(behavior: ScrollBehavior = 'smooth') {
    bottomRef.current?.scrollIntoView({ behavior });
    userScrolledUpRef.current = false;
    setShowScrollBtn(false);
  }

  function handleScroll() {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isUp = distFromBottom > 80;
    userScrolledUpRef.current = isUp;
    setShowScrollBtn(isUp);
  }

  // 스트리밍 중 자동 스크롤 (유저가 올려보는 중이면 멈춤)
  useEffect(() => {
    if (streaming && !userScrolledUpRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    }
  }, [messages, streaming]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || streaming) return;
    const question = input.trim();
    setInput('');
    userScrolledUpRef.current = false;
    scrollToBottom('instant');
    await sendMessage(question);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as unknown as React.FormEvent);
    }
  }

  function openCitation(citation: Citation) {
    setSelectedCitation(citation);
    setSheetOpen(true);
  }

  function formatSessionDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="relative flex h-[100dvh] flex-col bg-[#faf9f7]">
      <AppHeader
        backHref="/"
        title="RAG 채팅"
        subtitle={personaName ?? undefined}
        right={
          <>
            <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(true)} title="대화 기록">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">기록</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={startNewSession} title="새 대화 시작">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">새 대화</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(`/workspaces/${workspaceId}/settings`)}
              title="페르소나 설정"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDocsOpen(true)}>
              <FileText className="h-3.5 w-3.5" />
              문서{docs.length > 0 && ` ${docs.length}개`}
            </Button>
          </>
        }
      />

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-6"
      >
        <div className="mx-auto max-w-2xl flex flex-col gap-5">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-24 text-stone-400">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-blue-400" />
              </div>
              <p className="text-sm">문서를 업로드한 후 질문해 보세요.</p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[82%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-stone-900 text-white'
                    : 'bg-white border border-stone-200 text-stone-900 shadow-sm'
                }`}
              >
                {msg.role === 'assistant' ? (
                  msg.content === '__NO_PROVIDER__' ? (
                    <p className="text-stone-500">
                      AI provider가 설정되지 않았습니다.{' '}
                      <Link href="/settings/provider" className="text-blue-700 underline underline-offset-2 hover:text-blue-800">
                        여기서 API 키를 등록하세요
                      </Link>
                    </p>
                  ) : msg.content ? (
                    <div className="chat-prose overflow-x-auto">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{msg.content}</ReactMarkdown>
                    </div>
                  ) : msg.thinkingStep ? (
                    <div className="flex items-center gap-2 text-stone-400">
                      <Search className="h-3.5 w-3.5 animate-pulse" />
                      <span className="text-xs truncate max-w-[240px]">
                        검색 중: {msg.thinkingStep}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-stone-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span className="text-xs">생각 중...</span>
                    </div>
                  )
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>

              {msg.citations.length > 0 && (
                <div className="flex flex-wrap gap-1.5 max-w-[82%]">
                  {msg.citations.map((c) => (
                    <button
                      key={c.chunkId}
                      onClick={() => openCitation(c)}
                      className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-500 hover:border-stone-300 hover:text-stone-700 shadow-sm transition-colors font-mono"
                    >
                      <FileText className="h-3 w-3" />
                      {c.filename}
                      <span className="text-stone-300">#{c.chunkIndex + 1}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* 맨 아래로 버튼 */}
      {showScrollBtn && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={() => scrollToBottom()}
            className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white/95 backdrop-blur-sm px-3 py-1.5 text-xs text-stone-600 shadow-md hover:bg-stone-50 transition-colors"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            최신 메시지로
          </button>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 border-t border-stone-200 bg-white/90 backdrop-blur-sm px-4 py-3">
        <form onSubmit={handleSend} className="mx-auto max-w-2xl flex gap-2 items-end">
          <textarea
            ref={inputRef}
            placeholder="문서에 대해 질문해 보세요... (Enter 전송 / Shift+Enter 줄바꿈)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming}
            rows={1}
            className="flex-1 min-h-[36px] max-h-[120px] resize-none rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-colors disabled:opacity-50 leading-5 overflow-y-auto"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
          />
          <Button type="submit" size="icon" disabled={streaming || !input.trim()} className="shrink-0 mb-0.5">
            {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>

      {/* Session History Sheet */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0 flex flex-col">
          <SheetHeader className="px-4 py-4 border-b border-stone-200">
            <SheetTitle className="text-sm font-semibold text-stone-900">대화 기록</SheetTitle>
            <SheetDescription className="text-xs text-stone-400">이전 대화를 선택하거나 새로 시작하세요.</SheetDescription>
          </SheetHeader>
          <div className="px-3 py-3 border-b border-stone-100">
            <Button size="sm" variant="outline" className="w-full justify-start gap-2" onClick={startNewSession}>
              <Plus className="h-3.5 w-3.5" />
              새 대화 시작
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {sessions.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-stone-400">대화 기록이 없습니다.</p>
            ) : (
              [...sessions].reverse().map((s) => (
                <div
                  key={s.id}
                  className={`group flex items-center gap-1 px-2 transition-colors hover:bg-stone-50 ${
                    s.id === sessionId ? 'bg-blue-50' : ''
                  }`}
                >
                  {pendingDeleteId === s.id ? (
                    <div className="flex flex-1 items-center gap-1 py-2 pl-2">
                      <span className="flex-1 text-xs text-red-600 font-medium">삭제할까요?</span>
                      <button
                        onClick={(e) => confirmDeleteSession(e, s.id)}
                        className="rounded px-2 py-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
                      >
                        삭제
                      </button>
                      <button
                        onClick={cancelDeleteSession}
                        className="rounded px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => switchSession(s.id)}
                        className={`flex flex-1 items-center gap-2 py-2.5 pl-2 text-xs ${
                          s.id === sessionId ? 'text-blue-700' : 'text-stone-600'
                        }`}
                      >
                        <MessageSquare className="h-3 w-3 shrink-0" />
                        <span className="truncate">{formatSessionDate(s.createdAt)}</span>
                      </button>
                      <button
                        onClick={(e) => requestDeleteSession(e, s.id)}
                        className="shrink-0 rounded p-1 text-stone-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
                        title="대화 삭제"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Document Sheet */}
      <Sheet open={docsOpen} onOpenChange={setDocsOpen}>
        <SheetContent side="right" className="w-72 p-0 flex flex-col">
          <SheetHeader className="px-4 py-4 border-b border-stone-200">
            <SheetTitle className="text-sm font-semibold text-stone-900">등록된 문서</SheetTitle>
            <SheetDescription className="text-xs text-stone-400">
              AI가 이 문서들을 참고해 답변합니다.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-2">
            {docs.length === 0 ? (
              <div className="px-4 py-8 flex flex-col items-center gap-2 text-stone-400">
                <FileText className="h-8 w-8 text-stone-200" />
                <p className="text-xs text-center">업로드된 문서가 없습니다.</p>
                <button
                  onClick={() => { setDocsOpen(false); router.push(`/workspaces/${workspaceId}/documents`); }}
                  className="text-xs text-blue-700 hover:underline"
                >
                  문서 업로드하러 가기
                </button>
              </div>
            ) : (
              docs.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-stone-50">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                  <span className="flex-1 truncate text-xs text-stone-700">{doc.filename}</span>
                  {doc.status === 'ready' && <CheckCircle className="h-3 w-3 shrink-0 text-green-600" />}
                  {doc.status === 'processing' && <Loader2 className="h-3 w-3 shrink-0 text-blue-500 animate-spin" />}
                  {doc.status === 'failed' && <XCircle className="h-3 w-3 shrink-0 text-red-500" />}
                  {doc.status === 'pending' && <Clock className="h-3 w-3 shrink-0 text-stone-400" />}
                </div>
              ))
            )}
          </div>
          <div className="px-4 py-3 border-t border-stone-100">
            <button
              onClick={() => { setDocsOpen(false); router.push(`/workspaces/${workspaceId}/documents`); }}
              className="w-full text-xs text-stone-500 hover:text-stone-700 flex items-center justify-center gap-1.5 py-1.5 rounded-md hover:bg-stone-50 transition-colors"
            >
              <FileText className="h-3 w-3" />
              문서 관리
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Citation Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-stone-400" />
              {selectedCitation?.filename}
            </SheetTitle>
            <SheetDescription className="font-mono text-xs text-stone-400">
              청크 #{(selectedCitation?.chunkIndex ?? 0) + 1}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 rounded-lg bg-stone-50 p-4 text-sm text-stone-700 leading-relaxed whitespace-pre-wrap border border-stone-200 font-mono">
            {selectedCitation?.excerpt}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function ChatPageWrapper() {
  return (
    <AuthGuard>
      <Suspense>
        <ChatPage />
      </Suspense>
    </AuthGuard>
  );
}
