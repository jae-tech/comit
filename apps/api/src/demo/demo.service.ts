import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, Subject } from 'rxjs';
import { eq, sql } from 'drizzle-orm';
import { DrizzleService } from '../database/drizzle.service';
import {
  workspaces,
  aiProviders,
  chatSessions,
  documents,
  type PersonaEntry,
} from '../database/schema';
import { ChatService } from '../chat/chat.service';

@Injectable()
export class DemoService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DemoService.name);
  private readonly workspaceId: string | undefined;
  private readonly userId: string | undefined;
  private enabled = false;

  constructor(
    private readonly config: ConfigService,
    private readonly drizzle: DrizzleService,
    private readonly chatService: ChatService,
  ) {
    this.workspaceId = this.config.get<string>('DEMO_WORKSPACE_ID');
    this.userId = this.config.get<string>('DEMO_USER_ID');
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.workspaceId || !this.userId) {
      this.logger.warn(
        'DEMO_WORKSPACE_ID or DEMO_USER_ID not set — demo endpoints disabled',
      );
      return;
    }

    // 워크스페이스 존재 + 소유권 검증
    const [ws] = await this.drizzle.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, this.workspaceId))
      .limit(1);

    if (!ws || ws.ownerId !== this.userId) {
      this.logger.warn(
        'Demo workspace not found or not owned by DEMO_USER_ID — demo endpoints disabled',
      );
      return;
    }

    // AI 프로바이더 존재 검증
    const providers = await this.drizzle.db
      .select()
      .from(aiProviders)
      .where(eq(aiProviders.userId, this.userId));

    if (providers.length === 0) {
      this.logger.warn(
        'No AI provider configured for demo user — demo endpoints disabled',
      );
      return;
    }
    if (providers.length > 1) {
      this.logger.warn(
        `Demo user has ${providers.length} providers — using first registered. Non-deterministic if multiple exist.`,
      );
    }

    this.enabled = true;
    this.logger.log(`DemoService ready — workspace: ${this.workspaceId}`);
  }

  private assertEnabled(): void {
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        'Demo is not configured on this server',
      );
    }
  }

  streamChat(question: string, sessionId?: string): Observable<MessageEvent> {
    this.assertEnabled();
    const subject = new Subject<MessageEvent>();
    this.processChat(question, sessionId, subject).catch((err: Error) => {
      subject.next({
        data: JSON.stringify({
          type: 'error',
          error: err.message,
        }),
      } as MessageEvent);
      subject.complete();
    });
    return subject.asObservable();
  }

  private async processChat(
    question: string,
    sessionId: string | undefined,
    subject: Subject<MessageEvent>,
  ): Promise<void> {
    const workspaceId = this.workspaceId!;
    const userId = this.userId!;

    // 세션 없으면 먼저 생성 후 session_created 청크 전송
    let resolvedSessionId = sessionId;
    if (!resolvedSessionId) {
      const [created] = await this.drizzle.db
        .insert(chatSessions)
        .values({ workspaceId, userId })
        .returning();
      resolvedSessionId = created.id;

      subject.next({
        data: JSON.stringify({
          type: 'session_created',
          sessionId: resolvedSessionId,
        }),
      } as MessageEvent);
    }

    const stream$ = this.chatService.streamQuery(userId, {
      workspaceId,
      question,
      sessionId: resolvedSessionId,
    });

    stream$.subscribe({
      next: (event) => subject.next(event),
      error: (err: Error) => {
        subject.next({
          data: JSON.stringify({
            type: 'error',
            error: err.message,
          }),
        } as MessageEvent);
        subject.complete();
      },
      complete: () => subject.complete(),
    });
  }

  async getDocs(): Promise<{ id: string; filename: string; status: string }[]> {
    this.assertEnabled();
    const hideDocs =
      this.config.get<string>('DEMO_HIDE_DOCS')?.toLowerCase() === 'true';
    if (hideDocs) return [];

    return this.drizzle.db
      .select({
        id: documents.id,
        filename: documents.filename,
        status: documents.status,
      })
      .from(documents)
      .where(eq(documents.workspaceId, this.workspaceId!));
  }

  async getInfo(): Promise<{
    personaName: string | null;
    systemPrompt: string | null;
    model: string;
    documentCount: number;
    personas: PersonaEntry[];
  }> {
    this.assertEnabled();
    const workspaceId = this.workspaceId!;
    const userId = this.userId!;

    const [ws] = await this.drizzle.db
      .select({
        personaName: workspaces.personaName,
        systemPrompt: workspaces.systemPrompt,
        personas: workspaces.personas,
      })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    const providers = await this.drizzle.db
      .select({ model: aiProviders.model })
      .from(aiProviders)
      .where(eq(aiProviders.userId, userId));

    const [{ count: documentCount }] = await this.drizzle.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(documents)
      .where(eq(documents.workspaceId, workspaceId));

    return {
      personaName: ws?.personaName ?? null,
      systemPrompt: ws?.systemPrompt ?? null,
      model: providers[0]?.model ?? 'unknown',
      documentCount: documentCount ?? 0,
      personas: ws?.personas ?? [],
    };
  }

  async updateSettings(dto: {
    personaName?: string;
    systemPrompt?: string;
  }): Promise<void> {
    this.assertEnabled();
    const updates: Record<string, unknown> = {};
    if (dto.personaName !== undefined) updates['personaName'] = dto.personaName;
    if (dto.systemPrompt !== undefined)
      updates['systemPrompt'] = dto.systemPrompt;
    if (Object.keys(updates).length === 0) return;

    await this.drizzle.db
      .update(workspaces)
      .set(updates)
      .where(eq(workspaces.id, this.workspaceId!));
  }

  async addPersona(dto: {
    name: string;
    prompt: string;
  }): Promise<PersonaEntry> {
    this.assertEnabled();
    const [ws] = await this.drizzle.db
      .select({ personas: workspaces.personas })
      .from(workspaces)
      .where(eq(workspaces.id, this.workspaceId!))
      .limit(1);

    const existing: PersonaEntry[] = ws?.personas ?? [];
    const newEntry: PersonaEntry = {
      id: crypto.randomUUID(),
      name: dto.name,
      prompt: dto.prompt,
    };
    const updated = [...existing, newEntry];

    await this.drizzle.db
      .update(workspaces)
      .set({ personas: updated })
      .where(eq(workspaces.id, this.workspaceId!));

    return newEntry;
  }

  async activatePersona(personaId: string): Promise<void> {
    this.assertEnabled();
    const [ws] = await this.drizzle.db
      .select({ personas: workspaces.personas })
      .from(workspaces)
      .where(eq(workspaces.id, this.workspaceId!))
      .limit(1);

    const personas: PersonaEntry[] = ws?.personas ?? [];
    const target = personas.find((p) => p.id === personaId);
    if (!target) {
      throw new Error(`Persona ${personaId} not found`);
    }

    await this.drizzle.db
      .update(workspaces)
      .set({ personaName: target.name, systemPrompt: target.prompt })
      .where(eq(workspaces.id, this.workspaceId!));
  }

  async removePersona(personaId: string): Promise<void> {
    this.assertEnabled();
    if (personaId.startsWith('00000000-0000-0000-0000-')) {
      throw new Error('기본 페르소나는 삭제할 수 없습니다');
    }

    const [ws] = await this.drizzle.db
      .select({ personas: workspaces.personas })
      .from(workspaces)
      .where(eq(workspaces.id, this.workspaceId!))
      .limit(1);

    const existing: PersonaEntry[] = ws?.personas ?? [];
    const updated = existing.filter((p) => p.id !== personaId);

    await this.drizzle.db
      .update(workspaces)
      .set({ personas: updated })
      .where(eq(workspaces.id, this.workspaceId!));
  }
}
