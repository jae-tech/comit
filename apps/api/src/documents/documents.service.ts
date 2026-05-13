import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { writeFile, unlink, mkdir, stat } from 'fs/promises';
import { join } from 'path';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { DrizzleService } from '../database/drizzle.service';
import { documents, type Document } from '../database/schema';
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
  private readonly logger = new Logger(DocumentsService.name);
  private readonly uploadDir = join(process.cwd(), 'uploads');

  constructor(
    private readonly drizzle: DrizzleService,
    @InjectQueue(EMBEDDING_QUEUE)
    private readonly embeddingQueue: Queue,
    private readonly workspacesService: WorkspacesService,
  ) {}

  async upload(workspaceId: string, userId: string, file: UploadedFileDto): Promise<Document> {
    await this.workspacesService.findOne(workspaceId, userId); // 403 if not owner

    await mkdir(this.uploadDir, { recursive: true });

    const safeFilename = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = join(this.uploadDir, safeFilename);
    this.logger.log(`Saving file: ${filePath} (bufferSize=${file.buffer.length})`);
    await writeFile(filePath, file.buffer);
    const saved = await stat(filePath);
    this.logger.log(`File saved OK: ${filePath} (diskSize=${saved.size})`);

    const [doc] = await this.drizzle.db
      .insert(documents)
      .values({
        workspaceId,
        filename: file.originalname,
        status: 'pending',
        fileSize: file.size,
        filePath,
      })
      .returning();

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

  async findAll(workspaceId: string, userId: string): Promise<Document[]> {
    await this.workspacesService.findOne(workspaceId, userId); // 403 if not owner
    return this.drizzle.db
      .select()
      .from(documents)
      .where(eq(documents.workspaceId, workspaceId));
  }

  async findOne(id: string, workspaceId: string, userId: string): Promise<Document> {
    await this.workspacesService.findOne(workspaceId, userId); // 403 if not owner
    const [doc] = await this.drizzle.db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.workspaceId, workspaceId)))
      .limit(1);

    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async remove(id: string, workspaceId: string, userId: string): Promise<void> {
    await this.workspacesService.findOne(workspaceId, userId); // 403 if not owner
    const [doc] = await this.drizzle.db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.workspaceId, workspaceId)))
      .limit(1);

    if (!doc) throw new NotFoundException('Document not found');

    try {
      await unlink(doc.filePath);
    } catch {
      // 파일이 이미 없어도 계속
    }

    // CASCADE로 chunks도 함께 삭제됨
    await this.drizzle.db
      .delete(documents)
      .where(eq(documents.id, id));
  }
}
