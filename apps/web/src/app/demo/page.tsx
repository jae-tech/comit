'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { MessageSquare, X, Send, Loader2, FileText, Info } from 'lucide-react';
import { ComitLogo } from '@/components/comit-logo';
import { useDemoChat } from '@/hooks/useDemoChat';
import Link from 'next/link';

export default function DemoPage() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const { messages, streaming, sendMessage } = useDemoChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || streaming) return;
    const q = input.trim();
    setInput('');
    await sendMessage(q);
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] flex flex-col">
      {/* 헤더 */}
      <header className="fixed top-0 inset-x-0 z-40 bg-white border-b border-stone-200 px-4 h-12 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ComitLogo size={24} color="#1d4ed8" />
          <span className="text-sm font-semibold text-stone-900 tracking-tight">Comit 데모</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-700 transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            챗봇
          </button>
          <Link
            href="/demo/admin"
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 hover:border-stone-300 transition-colors"
          >
            <Info className="h-3.5 w-3.5" />
            어드민
          </Link>
        </div>
      </header>

      {/* 본문 */}
      <div className="flex-1 flex flex-col items-center justify-center pt-12">
      {/* 중앙 안내 문구 */}
      <div className="text-center px-4">
        <p className="text-sm text-stone-500 mb-2">
          우측 하단 버튼을 눌러 AI에게 질문해보세요.
        </p>
      </div>

      {/* 챗봇 플로팅 버블 */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* 채팅 위젯 팝업 */}
        {open && (
          <div className="w-[calc(100vw-3rem)] max-w-96 h-[520px] bg-white rounded-2xl shadow-xl border border-stone-200 flex flex-col overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-stone-900">
              <div className="flex items-center gap-2">
                <ComitLogo size={18} color="#ffffff" />
                <span className="text-sm font-medium text-white">Comit AI</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-stone-400 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 메시지 영역 */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-12 text-stone-400">
                  <MessageSquare className="h-8 w-8 text-stone-200" />
                  <p className="text-xs text-center">문서에 대해 무엇이든 물어보세요.</p>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-50 border border-stone-200 text-stone-800'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      msg.content ? (
                        <div className="prose prose-sm max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-stone-400">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>생각 중...</span>
                        </div>
                      )
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>

                  {msg.citations.length > 0 && (
                    <div className="flex flex-wrap gap-1 max-w-[85%]">
                      {msg.citations.map((c) => (
                        <span
                          key={c.chunkId}
                          className="flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[10px] text-stone-400 font-mono max-w-[120px] truncate"
                        >
                          <FileText className="h-2.5 w-2.5 shrink-0" />
                          {c.filename}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* 입력창 */}
            <div className="px-3 py-3 border-t border-stone-100">
              <form onSubmit={handleSend} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={streaming}
                  placeholder="질문을 입력하세요..."
                  className="flex-1 text-xs rounded-lg border border-stone-200 px-3 py-2 outline-none focus:border-stone-400 disabled:opacity-50 bg-stone-50"
                />
                <button
                  type="submit"
                  disabled={streaming || !input.trim()}
                  className="rounded-lg bg-stone-900 p-2 text-white disabled:opacity-40 hover:bg-stone-700 transition-colors"
                >
                  {streaming ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </button>
              </form>

              {/* CTA */}
              <div className="mt-2 text-center">
                <Link
                  href="/register"
                  className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
                >
                  Comit으로 직접 만들어보기 →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* 버블 버튼 */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="h-14 w-14 rounded-full bg-stone-900 text-white shadow-lg hover:bg-stone-700 transition-colors flex items-center justify-center"
          aria-label="채팅 열기"
        >
          {open ? (
            <X className="h-6 w-6" />
          ) : (
            <MessageSquare className="h-6 w-6" />
          )}
        </button>
      </div>
      </div>
    </div>
  );
}
