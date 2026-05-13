import 'reflect-metadata';
import { DataSource } from 'typeorm';

// migration CLI 실행 시 DATABASE_URL 환경변수를 직접 설정하거나 .env를 source 후 실행
// 예: DATABASE_URL=postgres://... pnpm db:migrate
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/../**/*.entity.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
});
