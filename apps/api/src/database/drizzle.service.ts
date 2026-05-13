import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type DrizzleDB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class DrizzleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DrizzleService.name);
  private client: postgres.Sql;
  db: DrizzleDB;

  constructor(private readonly config: ConfigService) {}

  get sql() {
    return this.client;
  }

  async onModuleInit() {
    const url = this.config.getOrThrow<string>('DATABASE_URL');
    this.client = postgres(url, { max: 10, onnotice: () => undefined });
    this.db = drizzle(this.client, { schema, logger: false });

    // pgvector extension 보장
    await this.db.execute(
      'CREATE EXTENSION IF NOT EXISTS vector' as unknown as Parameters<DrizzleDB['execute']>[0],
    );
    this.logger.log('Drizzle connected, pgvector ready');
  }

  async onModuleDestroy() {
    await this.client.end();
  }
}
