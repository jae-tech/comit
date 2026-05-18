import { StateGraph, END } from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Subject } from 'rxjs';
import type { Citation } from '@comit/shared';
import type { DrizzleService } from '@/database/drizzle.service';
import { ragStateChannels, type RagState } from './rag-state';
import { loadHistoryNode } from './nodes/load-history.node';
import { queryRewriteNode } from './nodes/query-rewrite.node';
import { retrieveNode } from './nodes/retrieve.node';
import { generateNode } from './nodes/generate.node';

export interface RagGraphDeps {
  drizzle: DrizzleService;
  retrieveContext: (
    workspaceId: string,
    query: string,
    apiKey: string,
    provider: string,
  ) => Promise<Citation[]>;
  isQuotaError: (err: unknown) => boolean;
  apiKey: string;
  provider: string;
  model: string | undefined;
  systemPrompt: string;
}

export function buildRagGraph(deps: RagGraphDeps, subject: Subject<MessageEvent>) {
  // 쿼리 재작성에 사용할 경량 LLM 호출 (히스토리 없이 짧은 시스템+유저 메시지만)
  async function callRewriteLlm(messages: Array<HumanMessage | SystemMessage>): Promise<string> {
    if (deps.provider === 'gemini') {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genai = new GoogleGenerativeAI(deps.apiKey);
      const systemMsg = messages.find((m) => m._getType() === 'system');
      const userMsg = messages.find((m) => m._getType() === 'human');
      const model = genai.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: systemMsg ? (systemMsg as { content: string }).content : undefined,
      });
      const result = await model.generateContent((userMsg as { content: string }).content);
      return result.response.text();
    } else {
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: deps.apiKey });
      const formatted = messages.map((m) => ({
        role: m._getType() === 'human' ? 'user' : 'system',
        content: (m as { content: string }).content,
      })) as Array<{ role: 'system' | 'user'; content: string }>;
      const res = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: formatted,
        max_tokens: 200,
      });
      return res.choices[0]?.message?.content ?? '';
    }
  }

  const graph = new StateGraph<RagState>({ channels: ragStateChannels })
    .addNode('load_history', async (state) => loadHistoryNode(state, deps.drizzle))
    .addNode('query_rewrite', async (state) => queryRewriteNode(state, subject, callRewriteLlm))
    .addNode('retrieve', async (state) =>
      retrieveNode(state, subject, deps.retrieveContext, deps.apiKey, deps.provider),
    )
    .addNode('generate', async (state) =>
      generateNode(state, subject, {
        apiKey: deps.apiKey,
        provider: deps.provider,
        model: deps.model,
        systemPrompt: deps.systemPrompt,
        isQuotaError: deps.isQuotaError,
        retrieveContext: deps.retrieveContext,
      }),
    )
    .addEdge('__start__', 'load_history')
    .addEdge('load_history', 'query_rewrite')
    .addEdge('query_rewrite', 'retrieve')
    .addEdge('retrieve', 'generate')
    .addEdge('generate', END);

  return graph.compile();
}
