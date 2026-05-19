import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DrizzleService } from '@/database/drizzle.service';
import { estimateCost } from '@/common/pricing';

export interface UserStats {
  userId: string;
  username: string;
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

    // 유저별 통계 — role='admin' 제외, 모델별 비용 계산을 위해 ai_providers 조인
    const userRows = await this.drizzle.db.execute<{
      user_id: string;
      username: string;
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
        COUNT(DISTINCT cs.id)                            AS session_count,
        COALESCE(SUM(CASE WHEN cm.role = 'assistant' THEN 1 ELSE 0 END), 0) AS message_count,
        COALESCE(SUM(CASE WHEN cm.role = 'assistant' THEN cm.input_tokens ELSE 0 END), 0) AS input_tokens,
        COALESCE(SUM(CASE WHEN cm.role = 'assistant' THEN cm.output_tokens ELSE 0 END), 0) AS output_tokens,
        (
          SELECT ap.model
          FROM workspaces w2
          INNER JOIN ai_providers ap ON ap.id = w2.active_provider_id
          WHERE w2.owner_id = u.id
          LIMIT 1
        )                                                 AS model,
        MAX(cm.created_at)                               AS last_activity_at
      FROM users u
      LEFT JOIN chat_sessions cs ON cs.user_id = u.id
      LEFT JOIN chat_messages cm ON cm.session_id = cs.id
      WHERE u.role != 'admin'
      GROUP BY u.id, u.username
      ORDER BY SUM(CASE WHEN cm.role = 'assistant' THEN cm.input_tokens ELSE 0 END) DESC NULLS LAST
    `);

    const byUser: UserStats[] = userRows.map((row) => {
      const inp = Number(row.input_tokens);
      const out = Number(row.output_tokens);
      return {
        userId: row.user_id,
        username: row.username,
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
}
