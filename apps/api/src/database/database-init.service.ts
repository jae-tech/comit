import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

const EMBEDDING_DIM = 768;

@Injectable()
export class DatabaseInitService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseInitService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.ensureVectorExtension();
  }

  private async ensureVectorExtension(): Promise<void> {
    await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS vector');

    // document_chunks.embedding 컬럼이 text 타입이면 vector(1536)으로 변환 (최초 1회)
    await this.dataSource.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='document_chunks' AND column_name='embedding' AND data_type='text'
        ) THEN
          ALTER TABLE document_chunks
            ALTER COLUMN embedding TYPE vector(${EMBEDDING_DIM}) USING embedding::vector;
        END IF;
      END $$;
    `);

    this.logger.log('pgvector extension ready');
  }
}
