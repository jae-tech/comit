/**
 * Demo seed 스크립트
 *
 * 실행: pnpm --filter @comit/api seed:demo
 *
 * 아래 작업을 순서대로 수행합니다:
 *   1. demo@comit.app 계정 생성 (이미 있으면 재사용)
 *   2. "Comit 데모" 워크스페이스 생성 (이미 있으면 재사용)
 *   3. AI 프로바이더 등록 (DEMO_API_KEY, DEMO_PROVIDER, DEMO_MODEL 기준)
 *   4. 루트 .env 파일에 DEMO_USER_ID / DEMO_WORKSPACE_ID 자동 기록
 *
 * 필수 환경변수 (.env):
 *   DATABASE_URL      — PostgreSQL 연결 문자열
 *   ENCRYPTION_KEY    — 64-char hex (32바이트 AES 키)
 *   DEMO_API_KEY      — 등록할 AI API 키 (예: sk-...)
 *   DEMO_PROVIDER     — openai | anthropic | gemini  (기본: openai)
 *   DEMO_MODEL        — 모델명 (기본: gpt-4o-mini)
 *   DEMO_PASSWORD     — 데모 계정 비밀번호 (기본: demo-password-change-me)
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'crypto';
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
const DEMO_API_KEY = process.env.DEMO_API_KEY;
const DEMO_PROVIDER = process.env.DEMO_PROVIDER ?? 'openai';
const DEMO_MODEL = process.env.DEMO_MODEL ?? 'gpt-4o-mini';
const DEMO_EMAIL = 'demo@com.it';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'demo';
const DEMO_WORKSPACE_NAME = 'Comit 데모';

if (!DATABASE_URL) throw new Error('DATABASE_URL이 설정되지 않았습니다');
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64)
  throw new Error('ENCRYPTION_KEY는 64자 hex 문자열이어야 합니다 (openssl rand -hex 32)');
if (!DEMO_API_KEY)
  throw new Error('DEMO_API_KEY가 설정되지 않았습니다 — .env에 추가하세요');

// ─── 암호화 ───────────────────────────────────────────────────────────────────

function encrypt(plaintext: string): { encryptedKey: string; iv: string } {
  const key = Buffer.from(ENCRYPTION_KEY!, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encryptedKey: Buffer.concat([encrypted, authTag]).toString('base64'),
    iv: iv.toString('base64'),
  };
}

// ─── .env 파일 업데이트 ───────────────────────────────────────────────────────

function updateEnvFile(updates: Record<string, string>): void {
  if (!fs.existsSync(envPath)) {
    console.warn(`.env 파일을 찾을 수 없습니다 (${envPath}) — 수동으로 설정하세요`);
    return;
  }

  let content = fs.readFileSync(envPath, 'utf-8');

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^(${key}=).*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `$1${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
  }

  fs.writeFileSync(envPath, content, 'utf-8');
}

// ─── 메인 ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Demo seed 시작...\n');

  const client = postgres(DATABASE_URL!);
  const db = drizzle(client, { schema });

  try {
    // pgvector extension 보장
    await db.execute(
      'CREATE EXTENSION IF NOT EXISTS vector' as unknown as Parameters<typeof db.execute>[0],
    );

    // 1. 유저 생성 또는 재사용
    let [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, DEMO_EMAIL))
      .limit(1);

    if (user) {
      console.log(`✅ 기존 데모 유저 재사용: ${user.email} (${user.id})`);
    } else {
      const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
      [user] = await db
        .insert(schema.users)
        .values({ email: DEMO_EMAIL, passwordHash })
        .returning();
      console.log(`✅ 데모 유저 생성: ${user.email} (${user.id})`);
    }

    // 2. 워크스페이스 생성 또는 재사용
    let [workspace] = await db
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.ownerId, user.id))
      .limit(1);

    if (workspace) {
      console.log(`✅ 기존 워크스페이스 재사용: ${workspace.name} (${workspace.id})`);
    } else {
      [workspace] = await db
        .insert(schema.workspaces)
        .values({
          ownerId: user.id,
          name: DEMO_WORKSPACE_NAME,
          personaName: 'Comit AI',
          systemPrompt:
            '당신은 업로드된 문서를 기반으로 질문에 답변하는 AI 어시스턴트입니다. ' +
            '문서에서 찾을 수 없는 내용은 솔직하게 모른다고 답변하세요.',
        })
        .returning();
      console.log(`✅ 워크스페이스 생성: ${workspace.name} (${workspace.id})`);
    }

    // 3. AI 프로바이더 생성 또는 재사용
    const [existingProvider] = await db
      .select()
      .from(schema.aiProviders)
      .where(eq(schema.aiProviders.userId, user.id))
      .limit(1);

    if (existingProvider) {
      console.log(`✅ 기존 AI 프로바이더 재사용: ${existingProvider.provider} / ${existingProvider.model}`);
    } else {
      const { encryptedKey, iv } = encrypt(DEMO_API_KEY!);
      await db.insert(schema.aiProviders).values({
        userId: user.id,
        provider: DEMO_PROVIDER,
        encryptedKey,
        iv,
        model: DEMO_MODEL,
      });
      console.log(`✅ AI 프로바이더 등록: ${DEMO_PROVIDER} / ${DEMO_MODEL}`);
    }

    // 4. .env 파일 업데이트
    updateEnvFile({
      DEMO_USER_ID: user.id,
      DEMO_WORKSPACE_ID: workspace.id,
      DEMO_ENABLED: 'true',
    });
    console.log(`\n✅ .env 업데이트 완료`);

    console.log('\n─────────────────────────────────────────');
    console.log('🎉 Demo seed 완료!\n');
    console.log(`  DEMO_USER_ID      = ${user.id}`);
    console.log(`  DEMO_WORKSPACE_ID = ${workspace.id}`);
    console.log(`  Provider          = ${DEMO_PROVIDER} / ${DEMO_MODEL}`);
    console.log('\n다음 단계:');
    console.log('  1. 앱 로그인 후 데모 워크스페이스에 문서를 업로드하세요');
    console.log('  2. API 서버를 재시작하면 데모가 활성화됩니다');
    console.log('─────────────────────────────────────────\n');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ Seed 실패:', err);
  process.exit(1);
});
