import type { Citation } from './document.types';

export interface ChatQueryDto {
  workspaceId: string;
  sessionId?: string;
  question: string;
}

export type ChatStreamChunk =
  | { type: 'token'; content: string }
  | { type: 'done'; citations: Citation[] }
  | { type: 'error'; error: string }
  | { type: 'quota_exceeded'; error?: string }
  | { type: 'session_created'; sessionId: string };

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  createdAt: string;
}
