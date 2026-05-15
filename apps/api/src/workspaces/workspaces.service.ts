import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { unlink } from 'fs/promises';
import { DrizzleService } from '../database/drizzle.service';
import {
  workspaces,
  documents,
  chatSessions,
  chatMessages,
  aiProviders,
  type Workspace,
} from '../database/schema';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

@Injectable()
export class WorkspacesService {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(userId: string, name: string): Promise<Workspace> {
    const [ws] = await this.drizzle.db
      .insert(workspaces)
      .values({ ownerId: userId, name })
      .returning();
    return ws;
  }

  async findAll(userId: string): Promise<Workspace[]> {
    return this.drizzle.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.ownerId, userId));
  }

  async findOne(id: string, userId: string): Promise<Workspace> {
    const [ws] = await this.drizzle.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id))
      .limit(1);

    if (!ws) throw new NotFoundException('Workspace not found');
    if (ws.ownerId !== userId) throw new ForbiddenException();
    return ws;
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateWorkspaceDto,
  ): Promise<Workspace> {
    await this.findOne(id, userId); // 403/404

    const patch: Partial<Workspace> = {};
    if (dto.personaName !== undefined)
      patch.personaName = dto.personaName || null;
    if (dto.systemPrompt !== undefined)
      patch.systemPrompt = dto.systemPrompt || null;

    const [updated] = await this.drizzle.db
      .update(workspaces)
      .set(patch)
      .where(eq(workspaces.id, id))
      .returning();

    return updated;
  }

  async setActiveProvider(
    id: string,
    userId: string,
    providerId: string,
  ): Promise<Workspace> {
    await this.findOne(id, userId); // 403/404

    // 해당 provider가 이 사용자 소유인지 검증
    const [provider] = await this.drizzle.db
      .select()
      .from(aiProviders)
      .where(
        and(eq(aiProviders.id, providerId), eq(aiProviders.userId, userId)),
      )
      .limit(1);

    if (!provider) throw new NotFoundException('Provider not found');

    const [updated] = await this.drizzle.db
      .update(workspaces)
      .set({ activeProviderId: providerId })
      .where(eq(workspaces.id, id))
      .returning();

    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId); // 403/404

    // 디스크 파일 정리
    const docs = await this.drizzle.db
      .select({ filePath: documents.filePath })
      .from(documents)
      .where(eq(documents.workspaceId, id));

    await Promise.allSettled(docs.map((d) => unlink(d.filePath)));

    // chat_messages → chat_sessions → documents → workspace 순으로 삭제
    // (DB FK에 CASCADE가 없으므로 직접 순서대로 삭제)
    const sessionIds = await this.drizzle.db
      .select({ id: chatSessions.id })
      .from(chatSessions)
      .where(eq(chatSessions.workspaceId, id));

    for (const { id: sessionId } of sessionIds) {
      await this.drizzle.db
        .delete(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId));
    }
    await this.drizzle.db
      .delete(chatSessions)
      .where(eq(chatSessions.workspaceId, id));
    await this.drizzle.db
      .delete(documents)
      .where(eq(documents.workspaceId, id));
    await this.drizzle.db.delete(workspaces).where(eq(workspaces.id, id));
  }
}
