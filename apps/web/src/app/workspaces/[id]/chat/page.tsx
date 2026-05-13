'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { chatApi, workspaceApi } from '@/lib/api';
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
import { Send, FileText, Loader2, Settings, MessageSquare } from 'lucide-react';

interface Citation {
  chunkId: string;
  documentId: string;
  filename: string;
  excerpt: string;
  chunkIndex: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
}

interface StreamChunk {
  type: 'token' | 'done' | 'error' | 'quota_exceeded';
  content?: string;
  citations?: Citation[];
  error?: string;
}

function ChatPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const workspaceId = params.id;

  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [personaName, setPersonaName] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    workspaceApi.get(workspaceId).then((res) => {
      setPersonaName(res.data.personaName);
    });
  }, [workspaceId]);

  const loadSession = useCallback(async () => {
    const sessions = await chatApi.sessions(workspaceId);
    if (sessions.data.length > 0) {
      const latest = sessions.data[sessions.data.length - 1];
      setSessionId(latest.id);
      const msgs = await chatApi.messages(latest.id);
      setMessages(msgs.data.map((m) => ({ ...m })));
    }
  }, [workspaceId]);

  useEffect(() => { loadSession(); }, [loadSession]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || streaming) return;

    const question = input.trim();
    setInput('');

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
      citations: [],
    };
    setMessages((prev) => [...prev, userMsg]);

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', citations: [] },
    ]);
    setStreaming(true);

    try {
      const res = await fetch(chatApi.queryUrl(), {
        method: 'POST',
        headers: chatApi.queryHeaders(),
        body: JSON.stringify({ workspaceId, question, sessionId }),
      });

      if (!res.ok || !res.body) throw new Error('Stream failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          const chunk: StreamChunk = JSON.parse(raw);

          if (chunk.type === 'token' && chunk.content) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + chunk.content } : m,
              ),
            );
          } else if (chunk.type === 'done') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, citations: chunk.citations ?? [] } : m,
              ),
            );
            const sessions = await chatApi.sessions(workspaceId);
            if (sessions.data.length > 0) {
              setSessionId(sessions.data[sessions.data.length - 1].id);
            }
          } else if (chunk.type === 'quota_exceeded') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: '일일 API 한도를 초과했습니다. 내일 다시 시도해 주세요.' }
                  : m,
              ),
            );
          } else if (chunk.type === 'error') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: `오류가 발생했습니다: ${chunk.error}` }
                  : m,
              ),
            );
          }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: '응답을 받아오는 중 오류가 발생했습니다.' }
            : m,
        ),
      );
    } finally {
      setStreaming(false);
    }
  }

  function openCitation(citation: Citation) {
    setSelectedCitation(citation);
    setSheetOpen(true);
  }

  return (
    <div className="flex h-screen flex-col bg-[#faf9f7]">
      <AppHeader
        backHref="/"
        title="RAG 채팅"
        subtitle={personaName ?? undefined}
        right={
          <>
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
              onClick={() => router.push(`/workspaces/${workspaceId}/documents`)}
            >
              <FileText className="h-3.5 w-3.5" />
              문서
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
                  msg.content ? (
                    <div className="prose prose-sm max-w-none prose-stone">
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
