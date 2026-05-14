'use client';

import { useState, useCallback } from 'react';
import { chatApi, authFetch } from '@/lib/api';

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
  type: 'token' | 'done' | 'error' | 'quota_exceeded';
  content?: string;
  citations?: Citation[];
  error?: string;
}

interface UseStreamChatOptions {
  workspaceId: string;
  sessionId: string | undefined;
  onSessionCreated?: (sessionId: string) => void;
  onSessionsRefresh?: () => Promise<{ id: string; createdAt: string }[]>;
}

interface UseStreamChatReturn {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  streaming: boolean;
  sendMessage: (question: string) => Promise<void>;
}

export function useStreamChat({
  workspaceId,
  sessionId,
  onSessionCreated,
  onSessionsRefresh,
}: UseStreamChatOptions): UseStreamChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);

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
      const res = await authFetch(chatApi.queryUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
            if (onSessionsRefresh) {
              const updatedSessions = await onSessionsRefresh();
              if (updatedSessions.length > 0 && !sessionId) {
                onSessionCreated?.(updatedSessions[updatedSessions.length - 1].id);
              }
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
            const isNoProvider =
              chunk.error?.includes('provider not configured') ||
              chunk.error?.includes('AI provider');
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: isNoProvider
                        ? '__NO_PROVIDER__'
                        : `오류가 발생했습니다: ${chunk.error}`,
                    }
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
  }, [workspaceId, sessionId, streaming, onSessionCreated, onSessionsRefresh]);

  return { messages, setMessages, streaming, sendMessage };
}
