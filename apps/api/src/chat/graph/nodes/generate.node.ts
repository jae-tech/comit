import type { BaseMessage } from '@langchain/core/messages';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import type { Subject } from 'rxjs';
import type { Citation } from '@comit/shared';
import type { RagState } from '../rag-state';

export interface GenerateResult {
  fullContent: string;
  inputTokens: number | null;
  outputTokens: number | null;
  aborted: boolean;
}

type IsQuotaError = (err: unknown) => boolean;

export async function generateNode(
  state: RagState,
  subject: Subject<MessageEvent>,
  opts: {
    apiKey: string;
    provider: string;
    model: string | undefined;
    systemPrompt: string;
    isQuotaError: IsQuotaError;
  },
): Promise<Partial<RagState>> {
  const context = state.citations
    .map((c: Citation) => `[${c.filename}]\n${c.excerpt}`)
    .join('\n\n---\n\n');

  const userContent = context
    ? `Context:\n${context}\n\nQuestion: ${state.originalQuestion}`
    : state.originalQuestion;

  const messages: BaseMessage[] = [
    new SystemMessage(opts.systemPrompt),
    ...state.history,
    new HumanMessage(userContent),
  ];

  let result: GenerateResult;
  if (opts.provider === 'gemini') {
    result = await streamGemini(messages, opts, subject);
  } else {
    result = await streamOpenAI(messages, opts, subject);
  }

  return {
    fullContent: result.fullContent,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    aborted: result.aborted,
  };
}

async function streamOpenAI(
  messages: BaseMessage[],
  opts: { apiKey: string; model: string | undefined; isQuotaError: IsQuotaError },
  subject: Subject<MessageEvent>,
): Promise<GenerateResult> {
  const { default: OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey: opts.apiKey });

  const formatted = messages.map((m) => ({
    role: m._getType() === 'human' ? 'user' : m._getType() === 'ai' ? 'assistant' : 'system',
    content: (m as { content: string }).content,
  })) as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;

  let stream: Awaited<ReturnType<typeof openai.chat.completions.create>>;
  try {
    stream = await openai.chat.completions.create({
      model: opts.model || 'gpt-4o-mini',
      stream: true,
      stream_options: { include_usage: true },
      messages: formatted,
    });
  } catch (err) {
    if (opts.isQuotaError(err)) {
      subject.next({
        data: JSON.stringify({ type: 'quota_exceeded', error: '일일 API 한도를 초과했습니다. 내일 다시 시도해 주세요.' }),
      } as MessageEvent);
      subject.complete();
      return { fullContent: '', inputTokens: null, outputTokens: null, aborted: true };
    }
    throw err;
  }

  let fullContent = '';
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;

  for await (const chunk of stream as AsyncIterable<import('openai/resources/chat/completions').ChatCompletionChunk>) {
    const token = chunk.choices[0]?.delta?.content ?? '';
    if (token) {
      fullContent += token;
      subject.next({ data: JSON.stringify({ type: 'token', content: token }) } as MessageEvent);
    }
    if (chunk.usage) {
      inputTokens = chunk.usage.prompt_tokens;
      outputTokens = chunk.usage.completion_tokens;
    }
  }

  return { fullContent, inputTokens, outputTokens, aborted: false };
}

async function streamGemini(
  messages: BaseMessage[],
  opts: { apiKey: string; model: string | undefined; isQuotaError: IsQuotaError },
  subject: Subject<MessageEvent>,
): Promise<GenerateResult> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genai = new GoogleGenerativeAI(opts.apiKey);

  // SystemMessage를 systemInstruction으로 분리
  const systemMsg = messages.find((m) => m._getType() === 'system');
  const chatMessages = messages.filter((m) => m._getType() !== 'system');

  const geminiModel = genai.getGenerativeModel({
    model: opts.model || 'gemini-2.5-flash',
    systemInstruction: systemMsg ? (systemMsg as { content: string }).content : undefined,
  });

  // 히스토리(최근 메시지 제외)와 최신 메시지 분리
  const history = chatMessages.slice(0, -1).map((m) => ({
    role: m._getType() === 'human' ? 'user' : 'model',
    parts: [{ text: (m as { content: string }).content }],
  }));
  const lastMessage = chatMessages[chatMessages.length - 1];
  const userContent = (lastMessage as { content: string }).content;

  const chat = geminiModel.startChat({ history });

  let stream: Awaited<ReturnType<typeof chat.sendMessageStream>>;
  try {
    stream = await chat.sendMessageStream(userContent);
  } catch (err) {
    if (opts.isQuotaError(err)) {
      subject.next({
        data: JSON.stringify({ type: 'quota_exceeded', error: '일일 API 한도를 초과했습니다. 내일 다시 시도해 주세요.' }),
      } as MessageEvent);
      subject.complete();
      return { fullContent: '', inputTokens: null, outputTokens: null, aborted: true };
    }
    throw err;
  }

  let fullContent = '';
  try {
    for await (const chunk of stream.stream) {
      const token = chunk.text();
      if (token) {
        fullContent += token;
        subject.next({ data: JSON.stringify({ type: 'token', content: token }) } as MessageEvent);
      }
    }
  } catch (err) {
    if (opts.isQuotaError(err)) {
      subject.next({
        data: JSON.stringify({ type: 'quota_exceeded', error: '일일 API 한도를 초과했습니다. 내일 다시 시도해 주세요.' }),
      } as MessageEvent);
      subject.complete();
      return { fullContent, inputTokens: null, outputTokens: null, aborted: true };
    }
    throw err;
  }

  const response = await stream.response;
  const usage = response.usageMetadata;
  return {
    fullContent,
    inputTokens: usage?.promptTokenCount ?? null,
    outputTokens: usage?.candidatesTokenCount ?? null,
    aborted: false,
  };
}
