import type { BaseMessage } from '@langchain/core/messages';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { Subject } from 'rxjs';
import type { Citation } from '@comit/shared';
import type { RagState } from '../rag-state';
import { makeDocumentSearchTool } from '../tools/document-search.tool';

const MAX_TOOL_CALLS = 3;

export interface GenerateResult {
  fullContent: string;
  citations: Citation[];
  inputTokens: number | null;
  outputTokens: number | null;
  aborted: boolean;
}

type IsQuotaError = (err: unknown) => boolean;
type RetrieveFn = (
  workspaceId: string,
  query: string,
  apiKey: string,
  provider: string,
) => Promise<Citation[]>;

export async function generateNode(
  state: RagState,
  subject: Subject<MessageEvent>,
  opts: {
    apiKey: string;
    provider: string;
    model: string | undefined;
    systemPrompt: string;
    isQuotaError: IsQuotaError;
    retrieveContext: RetrieveFn;
  },
): Promise<Partial<RagState>> {
  const searchTool = makeDocumentSearchTool(
    opts.retrieveContext,
    state.workspaceId,
    opts.apiKey,
    opts.provider,
  );

  const buildContext = (citations: Citation[]): string =>
    citations.map((c) => `[${c.filename}]\n${c.excerpt}`).join('\n\n---\n\n');

  const userContent = (citations: Citation[]): string => {
    const ctx = buildContext(citations);
    return ctx
      ? `Context:\n${ctx}\n\nQuestion: ${state.originalQuestion}`
      : state.originalQuestion;
  };

  const messages: BaseMessage[] = [
    new SystemMessage(opts.systemPrompt),
    ...state.history,
    new HumanMessage(userContent(state.citations)),
  ];

  let result: GenerateResult;
  if (opts.provider === 'gemini') {
    result = await streamGeminiReAct(
      messages,
      state,
      searchTool,
      opts,
      subject,
    );
  } else {
    result = await streamOpenAIReAct(
      messages,
      state,
      searchTool,
      opts,
      subject,
    );
  }

  return {
    fullContent: result.fullContent,
    citations: result.citations,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    aborted: result.aborted,
  };
}

// ─── OpenAI ReAct ────────────────────────────────────────────────────────────

async function streamOpenAIReAct(
  initialMessages: BaseMessage[],
  state: RagState,
  searchTool: ReturnType<typeof makeDocumentSearchTool>,
  opts: {
    apiKey: string;
    model: string | undefined;
    isQuotaError: IsQuotaError;
  },
  subject: Subject<MessageEvent>,
): Promise<GenerateResult> {
  const { default: OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey: opts.apiKey });

  const toOpenAIMessages = (msgs: BaseMessage[]) =>
    msgs.map((m) => ({
      role:
        m._getType() === 'human'
          ? 'user'
          : m._getType() === 'ai'
            ? 'assistant'
            : 'system',
      content: (m as { content: string }).content,
    })) as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;

  const tools: any[] = [
    {
      type: 'function',
      function: {
        name: searchTool.name,
        description: searchTool.description,
        parameters: searchTool.parameters,
      },
    },
  ];

  const messages: any[] = toOpenAIMessages(initialMessages);
  const accumulatedCitations = [...state.citations];
  let toolCallCount = 0;
  let totalInputTokens: number | null = null;
  let totalOutputTokens: number | null = null;

  while (toolCallCount <= MAX_TOOL_CALLS) {
    const isLastIteration = toolCallCount === MAX_TOOL_CALLS;

    let stream: Awaited<ReturnType<typeof openai.chat.completions.create>>;
    try {
      stream = await openai.chat.completions.create({
        model: opts.model || 'gpt-4o-mini',
        stream: true,
        stream_options: { include_usage: true },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        messages,
        tools: isLastIteration ? undefined : tools,
        tool_choice: isLastIteration ? undefined : 'auto',
      });
    } catch (err) {
      if (opts.isQuotaError(err)) {
        subject.next({
          data: JSON.stringify({
            type: 'quota_exceeded',
            error: '일일 API 한도를 초과했습니다. 내일 다시 시도해 주세요.',
          }),
        } as MessageEvent);
        subject.complete();
        return {
          fullContent: '',
          citations: accumulatedCitations,
          inputTokens: null,
          outputTokens: null,
          aborted: true,
        };
      }
      throw err;
    }

    // 스트리밍 청크 수집
    let fullContent = '';
    const toolCallBuffers: Record<number, { name: string; arguments: string }> =
      {};
    let finishReason: string | null = null;

    for await (const chunk of stream as AsyncIterable<
      import('openai/resources/chat/completions').ChatCompletionChunk
    >) {
      const delta = chunk.choices[0]?.delta;
      finishReason = chunk.choices[0]?.finish_reason ?? finishReason;

      // tool_calls arguments는 여러 청크에 걸쳐 fragmented로 전달됨 — concat 필요
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!toolCallBuffers[tc.index]) {
            toolCallBuffers[tc.index] = { name: '', arguments: '' };
          }
          if (tc.function?.name)
            toolCallBuffers[tc.index].name = tc.function.name;
          if (tc.function?.arguments)
            toolCallBuffers[tc.index].arguments += tc.function.arguments;
        }
      }

      const token = delta?.content ?? '';
      if (token) {
        fullContent += token;
        subject.next({
          data: JSON.stringify({ type: 'token', content: token }),
        } as MessageEvent);
      }

      if (chunk.usage) {
        totalInputTokens = (totalInputTokens ?? 0) + chunk.usage.prompt_tokens;
        totalOutputTokens =
          (totalOutputTokens ?? 0) + chunk.usage.completion_tokens;
      }
    }

    // tool_calls가 있으면 ReAct 루프 실행
    if (
      finishReason === 'tool_calls' &&
      Object.keys(toolCallBuffers).length > 0 &&
      !isLastIteration
    ) {
      const assistantToolCallMessage = {
        role: 'assistant' as const,
        content: null,
        tool_calls: Object.entries(toolCallBuffers).map(([idx, tc]) => ({
          id: `tool_${toolCallCount}_${idx}`,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
      messages.push(assistantToolCallMessage);

      for (const [idx, tc] of Object.entries(toolCallBuffers)) {
        let toolInput: unknown;
        try {
          toolInput = JSON.parse(tc.arguments);
        } catch {
          toolInput = { query: '' };
        }

        subject.next({
          data: JSON.stringify({
            type: 'thinking',
            step: 'tool_call',
            detail: (toolInput as { query?: string }).query ?? '',
          }),
        } as MessageEvent);

        const searchResult = await searchTool.execute(toolInput);

        // citations accumulate + chunkId dedup
        const existingIds = new Set(accumulatedCitations.map((c) => c.chunkId));
        for (const c of searchResult.citations) {
          if (!existingIds.has(c.chunkId)) {
            accumulatedCitations.push(c);
            existingIds.add(c.chunkId);
          }
        }

        const toolResultMessage = {
          role: 'tool' as const,
          tool_call_id: `tool_${toolCallCount}_${idx}`,
          content:
            searchResult.citations.length > 0
              ? searchResult.citations
                  .map((c) => `[${c.filename}]\n${c.excerpt}`)
                  .join('\n\n---\n\n')
              : 'No additional documents found.',
        };
        messages.push(toolResultMessage);
      }

      toolCallCount++;
      continue;
    }

    // 일반 텍스트 응답 (tool call 없음) — 루프 종료
    return {
      fullContent,
      citations: accumulatedCitations,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      aborted: false,
    };
  }

  // max iterations 도달 — 마지막 응답으로 최종 생성
  return {
    fullContent: '',
    citations: accumulatedCitations,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    aborted: false,
  };
}

// ─── Gemini ReAct ────────────────────────────────────────────────────────────

async function streamGeminiReAct(
  initialMessages: BaseMessage[],
  state: RagState,
  searchTool: ReturnType<typeof makeDocumentSearchTool>,
  opts: {
    apiKey: string;
    model: string | undefined;
    isQuotaError: IsQuotaError;
  },
  subject: Subject<MessageEvent>,
): Promise<GenerateResult> {
  const { GoogleGenerativeAI, FunctionCallingMode } =
    await import('@google/generative-ai');
  const genai = new GoogleGenerativeAI(opts.apiKey);

  const systemMsg = initialMessages.find((m) => m._getType() === 'system');
  const chatMessages = initialMessages.filter((m) => m._getType() !== 'system');

  const geminiModel = genai.getGenerativeModel({
    model: opts.model || 'gemini-2.5-flash',
    systemInstruction: systemMsg
      ? (systemMsg as { content: string }).content
      : undefined,
    tools: [
      {
        functionDeclarations: [
          {
            name: searchTool.name,
            description: searchTool.description,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            parameters: searchTool.parameters as any,
          },
        ],
      },
    ],
    toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
  });

  // 히스토리(최근 메시지 제외)와 최신 메시지 분리

  type GeminiPart =
    | { text: string }
    | { functionCall: { name: string; args: unknown } }
    | { functionResponse: { name: string; response: { content: string } } };
  const history: Array<{ role: string; parts: GeminiPart[] }> = chatMessages
    .slice(0, -1)
    .map((m) => ({
      role: m._getType() === 'human' ? 'user' : 'model',
      parts: [{ text: (m as { content: string }).content }],
    }));
  const lastMessage = chatMessages[chatMessages.length - 1];
  let userContent = (lastMessage as { content: string }).content;

  const accumulatedCitations = [...state.citations];
  let toolCallCount = 0;
  let totalInputTokens: number | null = null;
  let totalOutputTokens: number | null = null;

  while (toolCallCount <= MAX_TOOL_CALLS) {
    const isLastIteration = toolCallCount === MAX_TOOL_CALLS;

    const modelForIter = isLastIteration
      ? genai.getGenerativeModel({
          model: opts.model || 'gemini-2.5-flash',
          systemInstruction: systemMsg
            ? (systemMsg as { content: string }).content
            : undefined,
        })
      : geminiModel;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const chat = modelForIter.startChat({ history } as any);

    let stream: Awaited<ReturnType<typeof chat.sendMessageStream>>;
    try {
      stream = await chat.sendMessageStream(userContent);
    } catch (err) {
      if (opts.isQuotaError(err)) {
        subject.next({
          data: JSON.stringify({
            type: 'quota_exceeded',
            error: '일일 API 한도를 초과했습니다. 내일 다시 시도해 주세요.',
          }),
        } as MessageEvent);
        subject.complete();
        return {
          fullContent: '',
          citations: accumulatedCitations,
          inputTokens: null,
          outputTokens: null,
          aborted: true,
        };
      }
      throw err;
    }

    let fullContent = '';
    let hasFunctionCall = false;
    const functionCalls: Array<{ name: string; args: unknown }> = [];

    try {
      for await (const chunk of stream.stream) {
        // Gemini에서 functionCall은 마지막 청크에 완성됨
        const parts = chunk.candidates?.[0]?.content?.parts ?? [];
        for (const part of parts) {
          if (part.functionCall) {
            hasFunctionCall = true;
            functionCalls.push({
              name: part.functionCall.name,
              args: part.functionCall.args,
            });
          }
          if (part.text) {
            fullContent += part.text;
            subject.next({
              data: JSON.stringify({ type: 'token', content: part.text }),
            } as MessageEvent);
          }
        }
      }
    } catch (err) {
      if (opts.isQuotaError(err)) {
        subject.next({
          data: JSON.stringify({
            type: 'quota_exceeded',
            error: '일일 API 한도를 초과했습니다. 내일 다시 시도해 주세요.',
          }),
        } as MessageEvent);
        subject.complete();
        return {
          fullContent,
          citations: accumulatedCitations,
          inputTokens: null,
          outputTokens: null,
          aborted: true,
        };
      }
      throw err;
    }

    const response = await stream.response;
    const usage = response.usageMetadata;
    totalInputTokens = (totalInputTokens ?? 0) + (usage?.promptTokenCount ?? 0);
    totalOutputTokens =
      (totalOutputTokens ?? 0) + (usage?.candidatesTokenCount ?? 0);

    if (hasFunctionCall && functionCalls.length > 0 && !isLastIteration) {
      // Gemini history에 model의 function call + user의 function response 추가
      const functionCallParts = functionCalls.map((fc) => ({
        functionCall: fc,
      }));
      history.push({ role: 'model', parts: functionCallParts });

      const functionResponseParts: GeminiPart[] = [];

      for (const fc of functionCalls) {
        subject.next({
          data: JSON.stringify({
            type: 'thinking',
            step: 'tool_call',
            detail: (fc.args as { query?: string }).query ?? '',
          }),
        } as MessageEvent);

        const searchResult = await searchTool.execute(fc.args);

        // citations accumulate + chunkId dedup
        const existingIds = new Set(accumulatedCitations.map((c) => c.chunkId));
        for (const c of searchResult.citations) {
          if (!existingIds.has(c.chunkId)) {
            accumulatedCitations.push(c);
            existingIds.add(c.chunkId);
          }
        }

        functionResponseParts.push({
          functionResponse: {
            name: fc.name,
            response: {
              content:
                searchResult.citations.length > 0
                  ? searchResult.citations
                      .map((c) => `[${c.filename}]\n${c.excerpt}`)
                      .join('\n\n---\n\n')
                  : 'No additional documents found.',
            },
          },
        });
      }

      history.push({ role: 'user', parts: functionResponseParts });

      // 누적 context로 다음 user 메시지 업데이트
      const ctx = accumulatedCitations
        .map((c) => `[${c.filename}]\n${c.excerpt}`)
        .join('\n\n---\n\n');
      const originalQuestion = state.originalQuestion;
      userContent = ctx
        ? `Context:\n${ctx}\n\nQuestion: ${originalQuestion}`
        : originalQuestion;

      toolCallCount++;
      continue;
    }

    // 일반 텍스트 응답
    return {
      fullContent,
      citations: accumulatedCitations,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      aborted: false,
    };
  }

  return {
    fullContent: '',
    citations: accumulatedCitations,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    aborted: false,
  };
}
