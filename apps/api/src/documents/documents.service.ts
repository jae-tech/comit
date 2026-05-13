import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { Document } from '../database/entities/document.entity';
import { DocumentChunk } from '../database/entities/document-chunk.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { EMBEDDING_QUEUE } from './constants';

export interface UploadedFileDto {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class DocumentsService {
  private readonly uploadDir = join(process.cwd(), 'uploads');

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(DocumentChunk)
    private readonly chunkRepo: Repository<DocumentChunk>,
    @InjectQueue(EMBEDDING_QUEUE)
    private readonly embeddingQueue: Queue,
    private readonly workspacesService: WorkspacesService,
  ) {}

  async upload(workspaceId: string, userId: string, file: UploadedFileDto) {
    await this.workspacesService.findOne(workspaceId, userId); // 403 if not owner

    // uploads 디렉토리 보장
    await mkdir(this.uploadDir, { recursive: true });

    const safeFilename = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = join(this.uploadDir, safeFilename);
    await writeFile(filePath, file.buffer);

    const doc = this.documentRepo.create({
      workspaceId,
      filename: file.originalname,
      status: 'pending',
      fileSize: file.size,
      filePath,
    });
    await this.documentRepo.save(doc);

    // BullMQ 큐에 embedding 작업 등록
    await this.embeddingQueue.add(
      'embed',
      { documentId: doc.id, userId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
      },
    );

    return doc;
  }

  async findAll(workspaceId: string, userId: string) {
    await this.workspacesService.findOne(workspaceId, userId); // 403 if not owner
    return this.documentRepo.findBy({ workspaceId });
  }

  async findOne(id: string, workspaceId: string, userId: string) {
    await this.workspacesService.findOne(workspaceId, userId); // 403 if not owner
    const doc = await this.documentRepo.findOneBy({ id, workspaceId });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async remove(id: string, workspaceId: string, userId: string) {
    await this.workspacesService.findOne(workspaceId, userId); // 403 if not owner
    const doc = await this.documentRepo.findOneBy({ id, workspaceId });
    if (!doc) throw new NotFoundException('Document not found');

    try {
      await unlink(doc.filePath);
    } catch {
      // 파일이 이미 없어도 계속 진행
    }

    // CASCADE로 chunks도 함께 삭제됨
    await this.documentRepo.remove(doc);
  }
}
