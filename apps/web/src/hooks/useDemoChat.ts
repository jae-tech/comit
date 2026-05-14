'use client';

import { useState, useRef, useCallback } from 'react';
import { demoApi } from '@/lib/api';

export interface Citation {
  chunkId: string;
  documentId: string;
  filename: string;
  excerpt: string;
  chunkIndex: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
}

interface StreamChunk {
  type: 'token' | 'done' | 'error' | 'quota_exceeded' | 'session_created';
  content?: string;
  citations?: Citation[];
  error?: string;
  sessionId?: string;
}

interface UseDemoChatReturn {
  messages: Message[];
  streaming: boolean;
  sendMessage: (question: string) => Promise<void>;
}

export function useDemoChat(): UseDemoChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const sessionIdRef = useRef<string | undefined>(undefined);

  const sendMessage = useCallback(async (question: string) => {
    if (!question.trim() || streaming) return;

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
      const res = await fetch(demoApi.chatUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          sessionId: sessionIdRef.current,
        }),
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

          if (chunk.type === 'session_created' && chunk.sessionId) {
            sessionIdRef.current = chunk.sessionId;
          } else if (chunk.type === 'token' && chunk.content) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + chunk.content }
                  : m,
              ),
            );
          } else if (chunk.type === 'done') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, citations: chunk.citations ?? [] }
                  : m,
              ),
            );
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
      // 스트림 실패 시 세션 초기화 — 다음 요청에서 새 세션 생성
      sessionIdRef.current = undefined;
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
  }, [streaming]);

  return { messages, streaming, sendMessage };
}
