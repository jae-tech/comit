import type { BaseMessage } from '@langchain/core/messages';
import type { Citation } from '@comit/shared';

export interface RagState {
  workspaceId: string;
  sessionId: string;
  userId: string;
  originalQuestion: string;
  rewrittenQuery: string;
  citations: Citation[];
  history: BaseMessage[];
  fullContent: string;
  inputTokens: number | null;
  outputTokens: number | null;
  aborted: boolean;
}

export const ragStateChannels = {
  workspaceId: { value: (_prev: string, next: string) => next },
  sessionId: { value: (_prev: string, next: string) => next },
  userId: { value: (_prev: string, next: string) => next },
  originalQuestion: { value: (_prev: string, next: string) => next },
  rewrittenQuery: { value: (_prev: string, next: string) => next },
  citations: { value: (_prev: Citation[], next: Citation[]) => next },
  history: { value: (_prev: BaseMessage[], next: BaseMessage[]) => next },
  fullContent: { value: (_prev: string, next: string) => next },
  inputTokens: {
    value: (_prev: number | null, next: number | null) => next,
  },
  outputTokens: {
    value: (_prev: number | null, next: number | null) => next,
  },
  aborted: { value: (_prev: boolean, next: boolean) => next },
};
