import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { DrizzleService } from '@/database/drizzle.service';
import { users } from '@/database/schema';
import { estimateCost } from '@/common/pricing';

export interface UserStats {
  userId: string;
  username: string;
  isActive: boolean;
  sessionCount: number;
  messageCount: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  lastActivityAt: string | null;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers30d: number;
  totalSessions: number;
  totalMessages: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostUsd: number;
  byUser: UserStats[];
}

export interface KeywordEntry {
  content: string;
  count: number;
  lastUsedAt: string;
}

export interface AdminKeywords {
  total: number;
  items: KeywordEntry[];
}

@Injectable()
export class AdminService {
  constructor(private readonly drizzle: DrizzleService) {}

  async getStats(): Promise<AdminStats> {
    const [summary] = await this.drizzle.db.execute<{
      total_users: string;
      active_users_30d: string;
      total_sessions: string;
      total_messages: string;
      total_input_tokens: string;
      total_output_tokens: string;
    }>(sql`
      SELECT
        (SELECT COUNT(*) FROM users WHERE role != 'admin')                           AS total_users,
        (
          SELECT COUNT(DISTINCT cs.user_id)
          FROM chat_sessions cs
          INNER JOIN chat_messages cm ON cm.session_id = cs.id
          INNER JOIN users u ON u.id = cs.user_id
          WHERE u.role != 'admin'
            AND cm.created_at >= NOW() - INTERVAL '30 days'
        )                                                                             AS active_users_30d,
        (SELECT COUNT(*) FROM chat_sessions cs
         INNER JOIN users u ON u.id = cs.user_id WHERE u.role != 'admin')           AS total_sessions,
        (SELECT COUNT(*) FROM chat_messages cm
         INNER JOIN chat_sessions cs ON cs.id = cm.session_id
         INNER JOIN users u ON u.id = cs.user_id
         WHERE u.role != 'admin' AND cm.role = 'assistant')                         AS total_messages,
        COALESCE((
          SELECT SUM(cm.input_tokens)
          FROM chat_messages cm
          INNER JOIN chat_sessions cs ON cs.id = cm.session_id
          INNER JOIN users u ON u.id = cs.user_id
          WHERE u.role != 'admin' AND cm.role = 'assistant'
        ), 0)                                                                         AS total_input_tokens,
        COALESCE((
          SELECT SUM(cm.output_tokens)
          FROM chat_messages cm
          INNER JOIN chat_sessions cs ON cs.id = cm.session_id
          INNER JOIN users u ON u.id = cs.user_id
          WHERE u.role != 'admin' AND cm.role = 'assistant'
        ), 0)                                                                         AS total_output_tokens
    `);

    // 유저별 통계 — role='admin' 제외, active_provider의 모델을 LATERAL JOIN으로 1회 조회
    const userRows = await this.drizzle.db.execute<{
      user_id: string;
      username: string;
      is_active: boolean;
      session_count: string;
      message_count: string;
      input_tokens: string;
      output_tokens: string;
      model: string | null;
      last_activity_at: string | null;
    }>(sql`
      SELECT
        u.id                                              AS user_id,
        u.username,
        u.is_active,
        COUNT(DISTINCT cs.id)                            AS session_count,
        COALESCE(SUM(CASE WHEN cm.role = 'assistant' THEN 1 ELSE 0 END), 0) AS message_count,
        COALESCE(SUM(CASE WHEN cm.role = 'assistant' THEN cm.input_tokens ELSE 0 END), 0) AS input_tokens,
        COALESCE(SUM(CASE WHEN cm.role = 'assistant' THEN cm.output_tokens ELSE 0 END), 0) AS output_tokens,
        ap.model                                          AS model,
        MAX(cm.created_at)                               AS last_activity_at
      FROM users u
      LEFT JOIN chat_sessions cs ON cs.user_id = u.id
      LEFT JOIN chat_messages cm ON cm.session_id = cs.id
      LEFT JOIN LATERAL (
        SELECT ap2.model
        FROM workspaces w2
        INNER JOIN ai_providers ap2 ON ap2.id = w2.active_provider_id
        WHERE w2.owner_id = u.id
        LIMIT 1
      ) ap ON true
      WHERE u.role != 'admin'
      GROUP BY u.id, u.username, u.is_active, ap.model
      ORDER BY SUM(CASE WHEN cm.role = 'assistant' THEN cm.input_tokens ELSE 0 END) DESC NULLS LAST
    `);

    const byUser: UserStats[] = userRows.map((row) => {
      const inp = Number(row.input_tokens);
      const out = Number(row.output_tokens);
      return {
        userId: row.user_id,
        username: row.username,
        isActive: row.is_active,
        sessionCount: Number(row.session_count),
        messageCount: Number(row.message_count),
        inputTokens: inp,
        outputTokens: out,
        costUsd: estimateCost(row.model ?? 'unknown', inp, out),
        lastActivityAt: row.last_activity_at ?? null,
      };
    });

    const totalInput = Number(summary.total_input_tokens);
    const totalOutput = Number(summary.total_output_tokens);

    // 전체 추정 비용은 byUser 합산으로 계산 (모델별 단가 적용)
    const estimatedCostUsd = byUser.reduce((acc, u) => acc + u.costUsd, 0);

    return {
      totalUsers: Number(summary.total_users),
      activeUsers30d: Number(summary.active_users_30d),
      totalSessions: Number(summary.total_sessions),
      totalMessages: Number(summary.total_messages),
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      estimatedCostUsd,
      byUser,
    };
  }

  async getKeywords(limit = 100): Promise<AdminKeywords> {
    const rows = await this.drizzle.db.execute<{
      content: string;
      count: string;
      last_used_at: string;
    }>(sql`
      SELECT
        TRIM(cm.content)           AS content,
        COUNT(*)                   AS count,
        MAX(cm.created_at)         AS last_used_at
      FROM chat_messages cm
      INNER JOIN chat_sessions cs ON cs.id = cm.session_id
      INNER JOIN users u ON u.id = cs.user_id
      WHERE cm.role = 'user'
        AND u.role != 'admin'
        AND TRIM(cm.content) != ''
      GROUP BY TRIM(cm.content)
      ORDER BY COUNT(*) DESC, MAX(cm.created_at) DESC
      LIMIT ${limit}
    `);

    const items: KeywordEntry[] = rows.map((r) => ({
      content: r.content,
      count: Number(r.count),
      lastUsedAt: r.last_used_at,
    }));

    return { total: items.length, items };
  }

  private async findUserNotAdmin(targetId: string) {
    const [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'admin') throw new ForbiddenException('Cannot modify admin account');
    return user;
  }

  async deleteUser(targetId: string): Promise<void> {
    await this.findUserNotAdmin(targetId);
    await this.drizzle.db.delete(users).where(eq(users.id, targetId));
  }

  async setUserActive(targetId: string, isActive: boolean): Promise<void> {
    await this.findUserNotAdmin(targetId);
    await this.drizzle.db
      .update(users)
      .set({ isActive })
      .where(eq(users.id, targetId));
  }

  async changeUserPassword(targetId: string, newPassword: string): Promise<void> {
    await this.findUserNotAdmin(targetId);
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.drizzle.db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, targetId));
  }
}
