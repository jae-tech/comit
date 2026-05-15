import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { resolve } from 'path';
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
    await this.db.execute('CREATE EXTENSION IF NOT EXISTS vector');

    // 미적용 마이그레이션 자동 실행
    // dev: src/database → ../../drizzle = apps/api/drizzle
    // prod: dist/database → ../../drizzle = apps/api/drizzle
    const migrationsFolder = resolve(__dirname, '../../drizzle');
    await migrate(this.db, { migrationsFolder });
    this.logger.log('Drizzle connected, pgvector ready, migrations applied');
  }

  async onModuleDestroy() {
    await this.client.end();
  }
}
