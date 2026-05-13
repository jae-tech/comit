import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Observable, Subject } from 'rxjs';
import OpenAI from 'openai';
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import { ChatSession } from '../database/entities/chat-session.entity';
import { ChatMessage } from '../database/entities/chat-message.entity';
import { ProvidersService } from '../providers/providers.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { ChatQueryDto, ChatStreamChunk, Citation } from '@orbit/shared';

const TOP_K = 5;
const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant that answers questions based on the provided document context.
Always cite your sources. If the answer cannot be found in the context, say so clearly.
Respond in the same language as the user's question.`;

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatSession)
    private readonly sessionRepo: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private readonly messageRepo: Repository<ChatMessage>,
    private readonly providersService: ProvidersService,
    private readonly workspacesService: WorkspacesService,
    private readonly dataSource: DataSource,
  ) {}

  /** POST /chat/query — fetch + ReadableStream 방식 (native EventSource는 GET only라 미사용) */
  streamQuery(
    userId: string,
    dto: ChatQueryDto,
  ): Observable<MessageEvent> {
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
    // 0. Workspace 소유권 검증 (403 if not owner) + 페르소나 읽기
    const workspace = await this.workspacesService.findOne(dto.workspaceId, userId);
    const systemPrompt = workspace.systemPrompt || DEFAULT_SYSTEM_PROMPT;

    // 1. Provider 확인
    const creds = await this.providersService.getDecryptedKey(userId);
    if (!creds) throw new NotFoundException('AI provider not configured');

    // 1.5. ready 문서 존재 여부 확인 (AI 호출 전 조기 차단)
    const [{ count }] = await this.dataSource.query<[{ count: string }]>(
      `SELECT COUNT(*)::int as count FROM documents WHERE workspace_id = $1 AND status = 'ready'`,
      [dto.workspaceId],
    );
    if (Number(count) === 0) {
      subject.next({
        data: JSON.stringify({ type: 'error', error: '문서를 먼저 업로드하고 임베딩이 완료되면 채팅이 가능합니다.' } as ChatStreamChunk),
      } as MessageEvent);
      subject.complete();
      return;
    }

    // 2. Session 생성 또는 재사용
    let session: ChatSession;
    if (dto.sessionId) {
      const found = await this.sessionRepo.findOneBy({ id: dto.sessionId, userId });
      if (!found) throw new NotFoundException('Session not found');
      session = found;
    } else {
      session = this.sessionRepo.create({ workspaceId: dto.workspaceId, userId });
      await this.sessionRepo.save(session);
    }

    // 3. 유저 메시지 저장
    await this.messageRepo.save(
      this.messageRepo.create({
        sessionId: session.id,
        role: 'user',
        content: dto.question,
        citations: [],
      }),
    );

    // 4. RAG: query embedding → pgvector cosine similarity
    const citations = await this.retrieveContext(dto.workspaceId, dto.question, creds.apiKey, creds.provider);
    const context = citations.map((c) => `[${c.filename}]\n${c.excerpt}`).join('\n\n---\n\n');
    const userContent = context
      ? `Context:\n${context}\n\nQuestion: ${dto.question}`
      : dto.question;

    // 5. LLM 스트리밍
    let fullContent = '';

    if (creds.provider === 'gemini') {
      fullContent = await this.streamGemini(creds.apiKey, creds.model, userContent, systemPrompt, subject);
    } else {
      fullContent = await this.streamOpenAI(creds.apiKey, creds.model, userContent, systemPrompt, subject);
    }

    // 6. done 이벤트에 citations 포함
    subject.next({
      data: JSON.stringify({ type: 'done', citations } as ChatStreamChunk),
    } as MessageEvent);

    // 7. 어시스턴트 메시지 저장
    await this.messageRepo.save(
      this.messageRepo.create({
        sessionId: session.id,
        role: 'assistant',
        content: fullContent,
        citations,
      }),
    );

    subject.complete();
  }

  private isQuotaError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const e = err as Record<string, unknown>;
    // Gemini: HTTP 429, status 'RESOURCE_EXHAUSTED'
    if (e['status'] === 'RESOURCE_EXHAUSTED') return true;
    if (typeof e['message'] === 'string' && /quota|rate.?limit|resource.?exhausted/i.test(e['message'])) return true;
    // OpenAI: error.status 429
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
        subject.next({
          data: JSON.stringify({ type: 'quota_exceeded', error: '일일 API 한도를 초과했습니다. 내일 다시 시도해 주세요.' } as ChatStreamChunk),
        } as MessageEvent);
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
          subject.next({
            data: JSON.stringify({ type: 'token', content: token } as ChatStreamChunk),
          } as MessageEvent);
        }
      }
    } catch (err) {
      if (this.isQuotaError(err)) {
        subject.next({
          data: JSON.stringify({ type: 'quota_exceeded', error: '일일 API 한도를 초과했습니다. 내일 다시 시도해 주세요.' } as ChatStreamChunk),
        } as MessageEvent);
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
        subject.next({
          data: JSON.stringify({ type: 'quota_exceeded', error: '일일 API 한도를 초과했습니다. 내일 다시 시도해 주세요.' } as ChatStreamChunk),
        } as MessageEvent);
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
        subject.next({
          data: JSON.stringify({ type: 'token', content: token } as ChatStreamChunk),
        } as MessageEvent);
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
    // 질문을 embedding으로 변환 (임베딩 시 사용한 provider와 동일하게)
    let queryVector: number[];

    if (provider === 'gemini') {
      const genai = new GoogleGenerativeAI(apiKey);
      const model = genai.getGenerativeModel({ model: 'gemini-embedding-001' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await model.embedContent({
        content: { role: 'user', parts: [{ text: question }] },
        taskType: TaskType.RETRIEVAL_QUERY,
        outputDimensionality: 768,
      } as any);
      queryVector = result.embedding.values;
    } else {
      const openai = new OpenAI({ apiKey });
      const embResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: question,
        dimensions: 768,
      });
      queryVector = embResponse.data[0].embedding;
    }

    // pgvector cosine similarity 검색
    const rows: Array<{
      id: string;
      document_id: string;
      filename: string;
      content: string;
      chunk_index: number;
      similarity: number;
    }> = await this.dataSource.query(
      `SELECT dc.id, dc.document_id, dc.chunk_index, d.filename, dc.content,
              1 - (dc.embedding <=> $1::vector) AS similarity
       FROM document_chunks dc
       JOIN documents d ON d.id = dc.document_id
       WHERE d.workspace_id = $2 AND d.status = 'ready'
       ORDER BY similarity DESC
       LIMIT $3`,
      [JSON.stringify(queryVector), workspaceId, TOP_K],
    );

    return rows.map((row) => ({
      chunkId: row.id,
      documentId: row.document_id,
      filename: row.filename,
      excerpt: row.content.slice(0, 200),
      chunkIndex: row.chunk_index,
    }));
  }

  async getSessions(workspaceId: string, userId: string) {
    await this.workspacesService.findOne(workspaceId, userId); // 403 if not owner
    return this.sessionRepo.findBy({ workspaceId, userId });
  }

  async getMessages(sessionId: string, userId: string) {
    const session = await this.sessionRepo.findOneBy({ id: sessionId, userId });
    if (!session) throw new NotFoundException('Session not found');
    return this.messageRepo.findBy({ sessionId });
  }
}
