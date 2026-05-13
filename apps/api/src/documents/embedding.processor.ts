import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import type { Job } from 'bull';
import { readFile, unlink } from 'fs/promises';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
import OpenAI from 'openai';
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import { Document } from '../database/entities/document.entity';
import { DocumentChunk } from '../database/entities/document-chunk.entity';
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
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(DocumentChunk)
    private readonly chunkRepo: Repository<DocumentChunk>,
    private readonly providersService: ProvidersService,
    private readonly dataSource: DataSource,
  ) {}

  @Process('embed')
  async handleEmbed(job: Job<{ documentId: string; userId: string }>) {
    const { documentId, userId } = job.data;
    const doc = await this.documentRepo.findOneBy({ id: documentId });
    if (!doc) return;

    try {
      await this.documentRepo.update(documentId, { status: 'processing' });

      // 1. 텍스트 추출
      const text = await this.extractText(doc.filePath, doc.filename);
      if (text.length < 100) {
        // 스캔 PDF 또는 내용 없음
        await this.documentRepo.update(documentId, { status: 'failed' });
        await this.deleteFile(doc.filePath);
        this.logger.warn(`Document ${documentId}: extracted text too short (scanned PDF?)`);
        return;
      }

      // 2. Chunking (문자 기준, overlap 포함)
      const chunks = this.splitIntoChunks(text);

      // 3. 사용자 Provider로 임베딩
      const creds = await this.providersService.getDecryptedKey(userId);
      if (!creds || (creds.provider !== 'openai' && creds.provider !== 'gemini')) {
        await this.documentRepo.update(documentId, { status: 'failed' });
        await this.deleteFile(doc.filePath);
        this.logger.warn(`Document ${documentId}: unsupported provider (need openai or gemini)`);
        return;
      }

      // 4. 기존 chunks 삭제 후 재삽입
      await this.chunkRepo.delete({ documentId });

      // 5. 배치 임베딩
      const vectors = await this.embedChunks(chunks, creds.provider, creds.apiKey);

      // 6. Bulk INSERT — N번 왕복 대신 1번 쿼리
      const values = chunks.map((_, i) => `(gen_random_uuid(), $1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4}::vector)`).join(', ');
      const params: unknown[] = [documentId];
      chunks.forEach((chunk, i) => {
        params.push(chunk, i, JSON.stringify(vectors[i]));
      });

      await this.dataSource.query(
        `INSERT INTO document_chunks (id, document_id, content, chunk_index, embedding) VALUES ${values}`,
        params,
      );

      await this.documentRepo.update(documentId, { status: 'ready' });
      this.logger.log(`Document ${documentId}: embedded ${chunks.length} chunks`);
    } catch (err) {
      this.logger.error(`Document ${documentId} embedding failed:`, err);
      await this.documentRepo.update(documentId, { status: 'failed' });
      await this.deleteFile(doc.filePath);
      throw err; // BullMQ retry를 위해 에러 재throw
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

    // Gemini: text-embedding-004, 기본 768차원 (SDK는 outputDimensionality 미지원)
    const genai = new GoogleGenerativeAI(apiKey);
    const model = genai.getGenerativeModel({ model: GEMINI_EMBEDDING_MODEL });

    // batchEmbedContents로 한 번에 처리 (outputDimensionality로 768차원으로 축소)
    // SDK 타입에 outputDimensionality가 없으나 API는 지원 — any로 우회
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
      // pdf-parse: 디지털 PDF만 지원. 스캔 PDF는 text 길이가 매우 짧음.
      const data = await pdfParse(buffer);
      return data.text;
    }

    // txt, md: 직접 읽기
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

    return chunks.filter((c) => c.length > 50); // 너무 짧은 청크 제거
  }

}
