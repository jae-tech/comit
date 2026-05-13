import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { unlink } from 'fs/promises';
import { Workspace } from '../database/entities/workspace.entity';
import { Document } from '../database/entities/document.entity';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepo: Repository<Workspace>,
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
  ) {}

  async create(userId: string, name: string) {
    const workspace = this.workspaceRepo.create({ ownerId: userId, name });
    return this.workspaceRepo.save(workspace);
  }

  async findAll(userId: string) {
    return this.workspaceRepo.findBy({ ownerId: userId });
  }

  async findOne(id: string, userId: string) {
    const ws = await this.workspaceRepo.findOneBy({ id });
    if (!ws) throw new NotFoundException('Workspace not found');
    if (ws.ownerId !== userId) throw new ForbiddenException();
    return ws;
  }

  async update(id: string, userId: string, dto: UpdateWorkspaceDto) {
    const ws = await this.findOne(id, userId);
    if (dto.personaName !== undefined) ws.personaName = dto.personaName || null;
    if (dto.systemPrompt !== undefined) ws.systemPrompt = dto.systemPrompt || null;
    return this.workspaceRepo.save(ws);
  }

  async remove(id: string, userId: string) {
    const ws = await this.findOne(id, userId); // 403/404 if not owner or not found

    // 디스크 파일 정리 (DB CASCADE 전에 실행)
    const docs = await this.documentRepo.findBy({ workspaceId: id });
    await Promise.allSettled(docs.map((d) => unlink(d.filePath)));

    // chat_sessions → chat_messages, documents → document_chunks 모두 CASCADE 삭제
    await this.workspaceRepo.remove(ws);
  }
}
