import { z } from 'zod';
import type { Citation } from './document.types';

export const ChatQuerySchema = z.object({
  workspaceId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  question: z.string().min(1).max(10000),
});

export type ChatQueryDto = z.infer<typeof ChatQuerySchema>;

export type ChatStreamChunk =
  | { type: 'token'; content: string }
  | { type: 'done'; citations: Citation[] }
  | { type: 'error'; error: string }
  | { type: 'quota_exceeded'; error?: string }
  | { type: 'session_created'; sessionId: string }
  | { type: 'thinking'; step: 'query_rewrite' | 'retrieve' | 'tool_call'; detail?: string };

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  createdAt: string;
}
