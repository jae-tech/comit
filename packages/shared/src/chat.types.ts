import type { Citation } from './document.types';

export interface ChatQueryDto {
  workspaceId: string;
  sessionId?: string;
  question: string;
}

export interface ChatStreamChunk {
  type: 'token' | 'done' | 'error' | 'quota_exceeded';
  content?: string;
  citations?: Citation[];
  error?: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  createdAt: string;
}
