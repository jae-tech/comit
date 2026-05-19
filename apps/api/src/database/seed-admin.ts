/**
 * Admin seed 스크립트
 *
 * 실행: pnpm --filter @comit/api seed:admin
 *
 * 관리자 계정을 생성하거나 기존 계정을 업데이트합니다.
 * 이미 동일 username 계정이 존재하면 role을 admin으로 설정하고 비밀번호를 재해시합니다.
 *
 * 필수 환경변수 (.env):
 *   DATABASE_URL      — PostgreSQL 연결 문자열
 *   ENCRYPTION_KEY    — 64-char hex (32바이트 AES 키)
 *   ADMIN_USERNAME    — 관리자 아이디 (없으면 exit 1)
 *   ADMIN_PASSWORD    — 관리자 비밀번호 최소 8자 (없으면 exit 1)
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import * as schema from './schema/index';

// ─── 환경변수 로드 ────────────────────────────────────────────────────────────

const envPath = path.resolve(process.cwd(), '../../.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

// ─── 설정 ────────────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL이 설정되지 않았습니다');
  process.exit(1);
}
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  console.error(
    '❌ ENCRYPTION_KEY는 64자 hex 문자열이어야 합니다 (openssl rand -hex 32)',
  );
  process.exit(1);
}
if (!ADMIN_USERNAME) {
  console.error('❌ ADMIN_USERNAME이 설정되지 않았습니다 — .env에 추가하세요');
  process.exit(1);
}
if (!ADMIN_PASSWORD) {
  console.error('❌ ADMIN_PASSWORD가 설정되지 않았습니다 — .env에 추가하세요');
  process.exit(1);
}
if (ADMIN_PASSWORD.length < 8) {
  console.error('❌ ADMIN_PASSWORD는 최소 8자 이상이어야 합니다');
  process.exit(1);
}

// ─── 메인 ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Admin seed 시작...\n');

  const client = postgres(DATABASE_URL!);
  const db = drizzle(client, { schema });

  try {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD!, 12);

    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, ADMIN_USERNAME!))
      .limit(1);

    if (existing) {
      await db
        .update(schema.users)
        .set({ passwordHash, role: 'admin' })
        .where(eq(schema.users.id, existing.id));
      console.log(`✅ Admin account updated: ${ADMIN_USERNAME} (${existing.id})`);
    } else {
      const [user] = await db
        .insert(schema.users)
        .values({ username: ADMIN_USERNAME!, passwordHash, role: 'admin' })
        .returning();
      console.log(`✅ Admin account created: ${ADMIN_USERNAME} (${user.id})`);
    }

    console.log('\n─────────────────────────────────────────');
    console.log('🎉 Admin seed 완료!\n');
    console.log(`  Username = ${ADMIN_USERNAME}`);
    console.log('  Role     = admin');
    console.log('\n관리자 대시보드: /admin');
    console.log('─────────────────────────────────────────\n');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ Seed 실패:', err);
  process.exit(1);
});
