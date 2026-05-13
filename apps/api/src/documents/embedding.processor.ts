import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { eq } from 'drizzle-orm';
import { readFile, unlink } from 'fs/promises';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
import OpenAI from 'openai';
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import { DrizzleService } from '../database/drizzle.service';
import { documents, documentChunks } from '../database/schema';
import { ProvidersService } from '../providers/providers.service';
import { EMBEDDING_QUEUE } from './constants';

const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 200;
const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIM = 768;

@Processor(EMBEDDING_QUEUE)
export class EmbeddingProcessor {
  private readonly logger = new Logger(EmbeddingProcessor.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly providersService: ProvidersService,
  ) {}

  @Process('embed')
  async handleEmbed(job: Job<{ documentId: string; userId: string }>) {
    const { documentId, userId } = job.data;

    const [doc] = await this.drizzle.db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (!doc) return;

    try {
      await this.drizzle.db
        .update(documents)
        .set({ status: 'processing' })
        .where(eq(documents.id, documentId));

      const text = await this.extractText(doc.filePath, doc.filename);
      if (text.length < 100) {
        await this.drizzle.db
          .update(documents)
          .set({ status: 'failed' })
          .where(eq(documents.id, documentId));
        await this.deleteFile(doc.filePath);
        this.logger.warn(`Document ${documentId}: extracted text too short (scanned PDF?)`);
        return;
      }

      const chunks = this.splitIntoChunks(text);

      const creds = await this.providersService.getDecryptedKey(userId);
      if (!creds || (creds.provider !== 'openai' && creds.provider !== 'gemini')) {
        await this.drizzle.db
          .update(documents)
          .set({ status: 'failed' })
          .where(eq(documents.id, documentId));
        await this.deleteFile(doc.filePath);
        this.logger.warn(`Document ${documentId}: unsupported provider (need openai or gemini)`);
        return;
      }

      // 기존 chunks 삭제 후 재삽입
      await this.drizzle.db
        .delete(documentChunks)
        .where(eq(documentChunks.documentId, documentId));

      const vectors = await this.embedChunks(chunks, creds.provider, creds.apiKey);

      // Bulk INSERT — postgres.js unsafe()로 vector 타입 처리
      const rows = chunks.map((chunk, i) => ({
        content: chunk,
        chunkIndex: i,
        embedding: vectors[i],
      }));

      for (const row of rows) {
        await this.drizzle.sql.unsafe(
          `INSERT INTO document_chunks (id, document_id, content, chunk_index, embedding)
           VALUES (gen_random_uuid(), $1, $2, $3, $4::vector)`,
          [documentId, row.content, row.chunkIndex, JSON.stringify(row.embedding)],
        );
      }

      await this.drizzle.db
        .update(documents)
        .set({ status: 'ready' })
        .where(eq(documents.id, documentId));

      this.logger.log(`Document ${documentId}: embedded ${chunks.length} chunks`);
    } catch (err) {
      this.logger.error(`Document ${documentId} embedding failed:`, err);
      await this.drizzle.db
        .update(documents)
        .set({ status: 'failed' })
        .where(eq(documents.id, documentId));
      // 파일이 없는 경우(ENOENT)는 재시도해도 의미 없으므로 throw 생략
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return;
      await this.deleteFile(doc.filePath);
      throw err;
    }
  }

  private async embedChunks(chunks: string[], provider: string, apiKey: string): Promise<number[][]> {
    if (provider === 'openai') {
      const openai = new OpenAI({ apiKey });
      const response = await openai.embeddings.create({
        model: OPENAI_EMBEDDING_MODEL,
        input: chunks,
        dimensions: EMBEDDING_DIM,
      });
      return response.data.map((d) => d.embedding);
    }

    const genai = new GoogleGenerativeAI(apiKey);
    const model = genai.getGenerativeModel({ model: GEMINI_EMBEDDING_MODEL });
    const result = await model.batchEmbedContents({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      requests: chunks.map((text) => ({
        content: { role: 'user', parts: [{ text }] },
        taskType: TaskType.RETRIEVAL_DOCUMENT,
        outputDimensionality: EMBEDDING_DIM,
      })) as any,
    });
    return result.embeddings.map((e) => e.values);
  }

  private async deleteFile(filePath: string): Promise<void> {
    try {
      await unlink(filePath);
    } catch {
      // 파일이 이미 없어도 무시
    }
  }

  private async extractText(filePath: string, filename: string): Promise<string> {
    const ext = filename.split('.').pop()?.toLowerCase();
    const buffer = await readFile(filePath);
    if (ext === 'pdf') {
      const data = await pdfParse(buffer);
      return data.text;
    }
    return buffer.toString('utf-8');
  }

  private splitIntoChunks(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + CHUNK_SIZE, text.length);
      chunks.push(text.slice(start, end).trim());
      start += CHUNK_SIZE - CHUNK_OVERLAP;
    }
    return chunks.filter((c) => c.length > 50);
  }
}
