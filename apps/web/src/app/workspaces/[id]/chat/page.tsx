'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { chatApi, workspaceApi, documentApi } from '@/lib/api';
import { AuthGuard } from '@/components/auth-guard';
import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Send, FileText, Loader2, Settings, MessageSquare, Plus, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useStreamChat, type Citation, type Message } from '@/hooks/useStreamChat';

interface Session {
  id: string;
  createdAt: string;
}

interface Doc {
  id: string;
  filename: string;
  status: string;
  fileSize: number;
}

function ChatPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const workspaceId = params.id;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [input, setInput] = useState('');
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [personaName, setPersonaName] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docsOpen, setDocsOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadSessions = useCallback(async () => {
    const res = await chatApi.sessions(workspaceId);
    setSessions(res.data);
    return res.data as Session[];
  }, [workspaceId]);

  const { messages, setMessages, streaming, sendMessage } = useStreamChat({
    workspaceId,
    sessionId,
    onSessionCreated: setSessionId,
    onSessionsRefresh: loadSessions,
  });

  useEffect(() => {
    workspaceApi.get(workspaceId).then((res) => {
      setPersonaName(res.data.personaName);
    });
    documentApi.list(workspaceId).then((res) => setDocs(res.data));
  }, [workspaceId]);

  const loadSession = useCallback(async (sid?: string) => {
    const sessionList = await loadSessions();
    if (sid) {
      setSessionId(sid);
      const msgs = await chatApi.messages(sid);
      setMessages(msgs.data.map((m) => ({ ...m })));
    } else if (sessionList.length > 0) {
      const latest = sessionList[sessionList.length - 1];
      setSessionId(latest.id);
      const msgs = await chatApi.messages(latest.id);
      setMessages(msgs.data.map((m) => ({ ...m })));
    }
  }, [loadSessions, setMessages]);

  useEffect(() => { loadSession(); }, [loadSession]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  function startNewSession() {
    setSessionId(undefined);
    setMessages([]);
    setSidebarOpen(false);
  }

  async function switchSession(sid: string) {
    setSessionId(sid);
    const msgs = await chatApi.messages(sid);
    setMessages(msgs.data.map((m) => ({ ...m })));
    setSidebarOpen(false);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || streaming) return;
    const question = input.trim();
    setInput('');
    await sendMessage(question);
  }

  function openCitation(citation: Citation) {
    setSelectedCitation(citation);
    setSheetOpen(true);
  }

  function formatSessionDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-[#faf9f7]">
      <AppHeader
        backHref="/"
        title="RAG 채팅"
        subtitle={personaName ?? undefined}
        right={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
              title="대화 기록"
            >
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">기록</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={startNewSession}
              title="새 대화 시작"
            >
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDocsOpen(true)}
            >
              <FileText className="h-3.5 w-3.5" />
              문서{docs.length > 0 && ` ${docs.length}개`}
            </Button>
          </>
        }
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
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
                    <div className="chat-prose">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
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

      {/* Input */}
      <div className="shrink-0 border-t border-stone-200 bg-white/90 backdrop-blur-sm px-4 py-3">
        <form onSubmit={handleSend} className="mx-auto max-w-2xl flex gap-2">
          <Input
            placeholder="문서에 대해 질문해 보세요..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={streaming}
          />
          <Button type="submit" size="icon" disabled={streaming || !input.trim()}>
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
                <button
                  key={s.id}
                  onClick={() => switchSession(s.id)}
                  className={`w-full text-left px-4 py-2.5 text-xs transition-colors hover:bg-stone-50 flex items-center gap-2 ${
                    s.id === sessionId ? 'bg-blue-50 text-blue-700' : 'text-stone-600'
                  }`}
                >
                  <MessageSquare className="h-3 w-3 shrink-0" />
                  <span className="truncate">{formatSessionDate(s.createdAt)}</span>
                </button>
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
      <ChatPage />
    </AuthGuard>
  );
}
