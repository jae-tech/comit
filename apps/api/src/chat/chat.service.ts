import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { Observable, Subject } from 'rxjs';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DrizzleService } from '../database/drizzle.service';
import {
  chatSessions,
  chatMessages,
  documents,
  documentChunks,
  type ChatSession,
  type ChatMessage,
} from '../database/schema';
import { ProvidersService } from '../providers/providers.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { ChatQueryDto, ChatStreamChunk, Citation } from '@comit/shared';

const TOP_K = 5;
const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant that answers questions based on the provided document context.
Always cite your sources. If the answer cannot be found in the context, say so clearly.
Respond in the same language as the user's question.`;

@Injectable()
export class ChatService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly providersService: ProvidersService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  streamQuery(userId: string, dto: ChatQueryDto): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();

    this.processQuery(userId, dto, subject).catch((err) => {
      subject.next({
        data: JSON.stringify({ type: 'error', error: err.message } as ChatStreamChunk),
      } as MessageEvent);
      subject.complete();
    });

    return subject.asObservable();
  }

  private async processQuery(
    userId: string,
    dto: ChatQueryDto,
    subject: Subject<MessageEvent>,
  ): Promise<void> {
    const workspace = await this.workspacesService.findOne(dto.workspaceId, userId);
    const systemPrompt = workspace.systemPrompt || DEFAULT_SYSTEM_PROMPT;

    const creds = await this.providersService.getDecryptedKey(userId);
    if (!creds) throw new NotFoundException('AI provider not configured');

    // ready 문서 존재 여부 확인
    const [{ count }] = await this.drizzle.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(documents)
      .where(and(eq(documents.workspaceId, dto.workspaceId), eq(documents.status, 'ready')));

    if (count === 0) {
      subject.next({
        data: JSON.stringify({ type: 'error', error: '문서를 먼저 업로드하고 임베딩이 완료되면 채팅이 가능합니다.' } as ChatStreamChunk),
      } as MessageEvent);
      subject.complete();
      return;
    }

    // Session 생성 또는 재사용
    let session: ChatSession;
    if (dto.sessionId) {
      const [found] = await this.drizzle.db
        .select()
        .from(chatSessions)
        .where(and(eq(chatSessions.id, dto.sessionId), eq(chatSessions.userId, userId)))
        .limit(1);
      if (!found) throw new NotFoundException('Session not found');
      session = found;
    } else {
      const [created] = await this.drizzle.db
        .insert(chatSessions)
        .values({ workspaceId: dto.workspaceId, userId })
        .returning();
      session = created;
    }

    // 유저 메시지 저장
    await this.drizzle.db.insert(chatMessages).values({
      sessionId: session.id,
      role: 'user',
      content: dto.question,
      citations: [],
    });

    // RAG: query embedding → pgvector cosine similarity
    const citations = await this.retrieveContext(dto.workspaceId, dto.question, creds.apiKey, creds.provider);
    const context = citations.map((c) => `[${c.filename}]\n${c.excerpt}`).join('\n\n---\n\n');
    const userContent = context
      ? `Context:\n${context}\n\nQuestion: ${dto.question}`
      : dto.question;

    // LLM 스트리밍
    let fullContent = '';
    if (creds.provider === 'gemini') {
      fullContent = await this.streamGemini(creds.apiKey, creds.model, userContent, systemPrompt, subject);
    } else {
      fullContent = await this.streamOpenAI(creds.apiKey, creds.model, userContent, systemPrompt, subject);
    }

    subject.next({
      data: JSON.stringify({ type: 'done', citations } as ChatStreamChunk),
    } as MessageEvent);

    await this.drizzle.db.insert(chatMessages).values({
      sessionId: session.id,
      role: 'assistant',
      content: fullContent,
      citations,
    });

    subject.complete();
  }

  private isQuotaError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const e = err as Record<string, unknown>;
    if (e['status'] === 'RESOURCE_EXHAUSTED') return true;
    if (typeof e['message'] === 'string' && /quota|rate.?limit|resource.?exhausted/i.test(e['message'])) return true;
    if (e['status'] === 429) return true;
    return false;
  }

  private async streamGemini(
    apiKey: string,
    model: string | undefined,
    userContent: string,
    systemPrompt: string,
    subject: Subject<MessageEvent>,
  ): Promise<string> {
    const genai = new GoogleGenerativeAI(apiKey);
    const geminiModel = genai.getGenerativeModel({
      model: model || 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
    });

    let stream: Awaited<ReturnType<typeof geminiModel.generateContentStream>>;
    try {
      stream = await geminiModel.generateContentStream(userContent);
    } catch (err) {
      if (this.isQuotaError(err)) {
        subject.next({ data: JSON.stringify({ type: 'quota_exceeded', error: '일일 API 한도를 초과했습니다. 내일 다시 시도해 주세요.' } as ChatStreamChunk) } as MessageEvent);
        subject.complete();
        return '';
      }
      throw err;
    }

    let fullContent = '';
    try {
      for await (const chunk of stream.stream) {
        const token = chunk.text();
        if (token) {
          fullContent += token;
          subject.next({ data: JSON.stringify({ type: 'token', content: token } as ChatStreamChunk) } as MessageEvent);
        }
      }
    } catch (err) {
      if (this.isQuotaError(err)) {
        subject.next({ data: JSON.stringify({ type: 'quota_exceeded', error: '일일 API 한도를 초과했습니다. 내일 다시 시도해 주세요.' } as ChatStreamChunk) } as MessageEvent);
        subject.complete();
        return fullContent;
      }
      throw err;
    }
    return fullContent;
  }

  private async streamOpenAI(
    apiKey: string,
    model: string | undefined,
    userContent: string,
    systemPrompt: string,
    subject: Subject<MessageEvent>,
  ): Promise<string> {
    const openai = new OpenAI({ apiKey });

    let stream: AsyncIterable<{ choices: Array<{ delta: { content?: string | null } }> }>;
    try {
      stream = await openai.chat.completions.create({
        model: model || 'gpt-4o-mini',
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      });
    } catch (err) {
      if (this.isQuotaError(err)) {
        subject.next({ data: JSON.stringify({ type: 'quota_exceeded', error: '일일 API 한도를 초과했습니다. 내일 다시 시도해 주세요.' } as ChatStreamChunk) } as MessageEvent);
        subject.complete();
        return '';
      }
      throw err;
    }

    let fullContent = '';
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content ?? '';
      if (token) {
        fullContent += token;
        subject.next({ data: JSON.stringify({ type: 'token', content: token } as ChatStreamChunk) } as MessageEvent);
      }
    }
    return fullContent;
  }

  private async retrieveContext(
    workspaceId: string,
    question: string,
    apiKey: string,
    provider: string,
  ): Promise<Citation[]> {
    let queryVector: number[];

    if (provider === 'gemini') {
      // SDK는 outputDimensionality를 지원하지 않으므로 REST 직접 호출
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: { role: 'user', parts: [{ text: question }] },
          taskType: 'RETRIEVAL_QUERY',
          outputDimensionality: 768,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini embedContent failed [${res.status}]: ${errText}`);
      }
      const data = await res.json() as { embedding: { values: number[] } };
      queryVector = data.embedding.values;
    } else {
      const openai = new OpenAI({ apiKey });
      const embResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: question,
        dimensions: 768,
      });
      queryVector = embResponse.data[0].embedding;
    }

    // pgvector cosine similarity 검색 — raw SQL (vector 연산자는 Drizzle이 미지원)
    const rows = await this.drizzle.db.execute(
      sql`
        SELECT dc.id, dc.document_id, dc.chunk_index, d.filename, dc.content,
               1 - (dc.embedding <=> ${JSON.stringify(queryVector)}::vector) AS similarity
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        WHERE d.workspace_id = ${workspaceId} AND d.status = 'ready'
        ORDER BY similarity DESC
        LIMIT ${TOP_K}
      `,
    );

    return (rows as unknown as Array<{
      id: string;
      document_id: string;
      filename: string;
      content: string;
      chunk_index: number;
      similarity: number;
    }>).map((row) => ({
      chunkId: row.id,
      documentId: row.document_id,
      filename: row.filename,
      excerpt: row.content.slice(0, 200),
      chunkIndex: row.chunk_index,
    }));
  }

  async getSessions(workspaceId: string, userId: string): Promise<ChatSession[]> {
    await this.workspacesService.findOne(workspaceId, userId);
    return this.drizzle.db
      .select()
      .from(chatSessions)
      .where(and(eq(chatSessions.workspaceId, workspaceId), eq(chatSessions.userId, userId)));
  }

  async getMessages(sessionId: string, userId: string): Promise<ChatMessage[]> {
    const [session] = await this.drizzle.db
      .select()
      .from(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
      .limit(1);

    if (!session) throw new NotFoundException('Session not found');

    return this.drizzle.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId));
  }
}
