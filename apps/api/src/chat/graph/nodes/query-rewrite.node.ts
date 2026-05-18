import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { Subject } from 'rxjs';
import type { RagState } from '../rag-state';

const REWRITE_SYSTEM = `You are a search query optimizer.
Given the conversation history and the user's latest question, rewrite the question
into a precise, standalone search query that resolves any pronouns or references
(e.g. "that document", "it", "the previous one") to their concrete subjects.
Return ONLY the rewritten query — no explanation, no punctuation wrapping.`;

export async function queryRewriteNode(
  state: RagState,
  subject: Subject<MessageEvent>,
  callLlm: (messages: Array<HumanMessage | SystemMessage>) => Promise<string>,
): Promise<Partial<RagState>> {
  // 히스토리가 없으면 재작성 불필요
  if (state.history.length === 0) {
    subject.next({
      data: JSON.stringify({
        type: 'thinking',
        step: 'query_rewrite',
        detail: 'no history — using original query',
      }),
    } as MessageEvent);
    return { rewrittenQuery: state.originalQuestion };
  }

  subject.next({
    data: JSON.stringify({
      type: 'thinking',
      step: 'query_rewrite',
    }),
  } as MessageEvent);

  const historyText = state.history
    .map(
      (m) =>
        `${m._getType() === 'human' ? 'User' : 'Assistant'}: ${(m as { content: string }).content}`,
    )
    .join('\n');

  const prompt = `Conversation history:\n${historyText}\n\nLatest question: ${state.originalQuestion}`;

  try {
    const rewritten = await callLlm([
      new SystemMessage(REWRITE_SYSTEM),
      new HumanMessage(prompt),
    ]);
    return { rewrittenQuery: rewritten.trim() || state.originalQuestion };
  } catch {
    // 재작성 실패 시 원본 질문 사용 — 쿼리 재작성은 best-effort
    return { rewrittenQuery: state.originalQuestion };
  }
}
