import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { Observable, Subject } from 'rxjs';
import OpenAI from 'openai';
import { DrizzleService } from '@/database/drizzle.service';
import {
  chatSessions,
  chatMessages,
  documents,
  type ChatSession,
  type ChatMessage,
} from '@/database/schema';
import { ProvidersService } from '@/providers/providers.service';
import { WorkspacesService } from '@/workspaces/workspaces.service';
import type { ChatQueryDto, Citation } from '@comit/shared';
import { buildRagGraph } from './graph/rag.graph';

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

    this.processQuery(userId, dto, subject).catch((err: Error) => {
      subject.next({
        data: JSON.stringify({ type: 'error', error: err.message }),
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
    const workspace = await this.workspacesService.findOne(
      dto.workspaceId,
      userId,
    );
    const systemPrompt = workspace.systemPrompt || DEFAULT_SYSTEM_PROMPT;

    // provider 우선순위: 워크스페이스 지정 키 → 유저 키 → admin 키(fallback)
    const creds =
      (workspace.activeProviderId
        ? await this.providersService.getDecryptedKeyById(
            userId,
            workspace.activeProviderId,
          )
        : null) ??
      (await this.providersService.getDecryptedKey(userId)) ??
      (await this.providersService.getAdminDecryptedKey());
    if (!creds) throw new NotFoundException('AI provider not configured');

    const [{ count }] = await this.drizzle.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(documents)
      .where(
        and(
          eq(documents.workspaceId, dto.workspaceId),
          eq(documents.status, 'ready'),
        ),
      );

    if (count === 0) {
      subject.next({
        data: JSON.stringify({
          type: 'error',
          error: '문서를 먼저 업로드하고 임베딩이 완료되면 채팅이 가능합니다.',
        }),
      } as MessageEvent);
      subject.complete();
      return;
    }

    // 세션 생성 또는 재사용
    let session: ChatSession;
    if (dto.sessionId) {
      const [found] = await this.drizzle.db
        .select()
        .from(chatSessions)
        .where(
          and(
            eq(chatSessions.id, dto.sessionId),
            eq(chatSessions.userId, userId),
            eq(chatSessions.workspaceId, dto.workspaceId),
          ),
        )
        .limit(1);
      if (!found) throw new NotFoundException('Session not found');
      session = found;
    } else {
      const [created] = await this.drizzle.db
        .insert(chatSessions)
        .values({ workspaceId: dto.workspaceId, userId })
        .returning();
      session = created;
      subject.next({
        data: JSON.stringify({
          type: 'session_created',
          sessionId: session.id,
        }),
      } as MessageEvent);
    }

    const compiledGraph = buildRagGraph(
      {
        drizzle: this.drizzle,
        retrieveContext: (w, q, k, p) => this.retrieveContext(w, q, k, p),
        isQuotaError: (e) => this.isQuotaError(e),
        apiKey: creds.apiKey,
        provider: creds.provider,
        model: creds.model,
        systemPrompt,
      },
      subject,
    );

    const result = await compiledGraph.invoke({
      workspaceId: dto.workspaceId,
      sessionId: session.id,
      userId,
      originalQuestion: dto.question,
      rewrittenQuery: dto.question,
      citations: [],
      history: [],
      fullContent: '',
      inputTokens: null,
      outputTokens: null,
      aborted: false,
    });

    if (result.aborted) return;

    // 그래프가 성공적으로 완료된 후에만 양쪽 메시지를 저장한다.
    // 이렇게 하면 그래프 실패 시 user 메시지가 고아로 남는 문제를 방지한다.
    await this.drizzle.db.insert(chatMessages).values({
      sessionId: session.id,
      role: 'user',
      content: dto.question,
      citations: [],
    });

    subject.next({
      data: JSON.stringify({ type: 'done', citations: result.citations }),
    } as MessageEvent);

    await this.drizzle.db.insert(chatMessages).values({
      sessionId: session.id,
      role: 'assistant',
      content: result.fullContent as string,
      citations: result.citations as Citation[],
      inputTokens: result.inputTokens as number | null,
      outputTokens: result.outputTokens as number | null,
    });

    subject.complete();
  }

  isQuotaError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const e = err as Record<string, unknown>;
    if (e['status'] === 'RESOURCE_EXHAUSTED') return true;
    if (
      typeof e['message'] === 'string' &&
      /quota|rate.?limit|resource.?exhausted/i.test(e['message'])
    )
      return true;
    if (e['status'] === 429) return true;
    return false;
  }

  async retrieveContext(
    workspaceId: string,
    question: string,
    apiKey: string,
    provider: string,
  ): Promise<Citation[]> {
    let queryVector: number[];

    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: { role: 'user', parts: [{ text: question }] },
          taskType: 'RETRIEVAL_QUERY',
          outputDimensionality: 768,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(
          `Gemini embedContent failed [${res.status}]: ${errText}`,
        );
      }
      const data = (await res.json()) as { embedding: { values: number[] } };
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

    if (queryVector.length !== 768) {
      throw new Error(
        `임베딩 차원 불일치: 기대 768, 실제 ${queryVector.length}`,
      );
    }

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

    return (
      rows as unknown as Array<{
        id: string;
        document_id: string;
        filename: string;
        content: string;
        chunk_index: number;
        similarity: number;
      }>
    ).map((row) => ({
      chunkId: row.id,
      documentId: row.document_id,
      filename: row.filename,
      excerpt: row.content.slice(0, 200),
      chunkIndex: row.chunk_index,
    }));
  }

  async deleteSession(sessionId: string, userId: string): Promise<void> {
    const [session] = await this.drizzle.db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.id, sessionId))
      .limit(1);

    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== userId) throw new ForbiddenException();

    await this.drizzle.db
      .delete(chatSessions)
      .where(eq(chatSessions.id, sessionId));
  }

  async getSessions(
    workspaceId: string,
    userId: string,
  ): Promise<ChatSession[]> {
    await this.workspacesService.findOne(workspaceId, userId);
    return this.drizzle.db
      .select()
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.workspaceId, workspaceId),
          eq(chatSessions.userId, userId),
        ),
      );
  }

  async getMessages(sessionId: string, userId: string): Promise<ChatMessage[]> {
    const [session] = await this.drizzle.db
      .select()
      .from(chatSessions)
      .where(
        and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)),
      )
      .limit(1);

    if (!session) throw new NotFoundException('Session not found');

    return this.drizzle.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId));
  }
}
