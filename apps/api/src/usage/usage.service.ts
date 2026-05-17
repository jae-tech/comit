import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DrizzleService } from '../database/drizzle.service';
import { estimateCost } from '../common/pricing';

export interface UsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalEmbeddingTokens: number;
  estimatedCostUsd: number;
  byWorkspace: WorkspaceUsage[];
}

export interface WorkspaceUsage {
  workspaceId: string;
  workspaceName: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface DailyUsage {
  date: string;
  inputTokens: number;
  outputTokens: number;
  embeddingTokens: number;
  costUsd: number;
}

export interface SessionUsage {
  sessionId: string;
  workspaceId: string;
  workspaceName: string;
  createdAt: string;
  messageCount: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

@Injectable()
export class UsageService {
  constructor(private readonly drizzle: DrizzleService) {}

  async getSummary(userId: string): Promise<UsageSummary> {
    // 전체 집계 (assistant 메시지만 — user 메시지는 토큰 없음)
    const [totals] = await this.drizzle.db.execute<{
      total_input: string;
      total_output: string;
    }>(sql`
      SELECT
        COALESCE(SUM(cm.input_tokens), 0)  AS total_input,
        COALESCE(SUM(cm.output_tokens), 0) AS total_output
      FROM chat_messages cm
      INNER JOIN chat_sessions cs ON cs.id = cm.session_id
      WHERE cs.user_id = ${userId}
        AND cm.role = 'assistant'
    `);

    const [embTotals] = await this.drizzle.db.execute<{
      total_embedding: string;
    }>(sql`
      SELECT COALESCE(SUM(d.embedding_tokens), 0) AS total_embedding
      FROM documents d
      INNER JOIN workspaces w ON w.id = d.workspace_id
      WHERE w.owner_id = ${userId}
    `);

    const totalInput = Number(totals.total_input);
    const totalOutput = Number(totals.total_output);

    // 워크스페이스별 집계
    const wsRows = await this.drizzle.db.execute<{
      workspace_id: string;
      workspace_name: string;
      input_tokens: string;
      output_tokens: string;
      model: string | null;
    }>(sql`
      SELECT
        w.id          AS workspace_id,
        w.name        AS workspace_name,
        COALESCE(SUM(cm.input_tokens), 0)  AS input_tokens,
        COALESCE(SUM(cm.output_tokens), 0) AS output_tokens,
        NULL::text    AS model
      FROM workspaces w
      LEFT JOIN chat_sessions cs ON cs.workspace_id = w.id AND cs.user_id = ${userId}
      LEFT JOIN chat_messages cm ON cm.session_id = cs.id AND cm.role = 'assistant'
      WHERE w.owner_id = ${userId}
      GROUP BY w.id, w.name
      ORDER BY SUM(cm.input_tokens) DESC NULLS LAST
    `);

    const byWorkspace: WorkspaceUsage[] = wsRows.map((row) => {
      const inp = Number(row.input_tokens);
      const out = Number(row.output_tokens);
      return {
        workspaceId: row.workspace_id,
        workspaceName: row.workspace_name,
        inputTokens: inp,
        outputTokens: out,
        // 워크스페이스별 모델 정보는 provider에 따라 다르므로 unknown 모델로 추정
        costUsd: estimateCost('unknown', inp, out),
      };
    });

    return {
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      totalEmbeddingTokens: Number(embTotals.total_embedding),
      estimatedCostUsd: estimateCost('unknown', totalInput, totalOutput),
      byWorkspace,
    };
  }

  async getDaily(userId: string, days = 30): Promise<DailyUsage[]> {
    const rows = await this.drizzle.db.execute<{
      date: string;
      input_tokens: string;
      output_tokens: string;
    }>(sql`
      SELECT
        DATE(cm.created_at AT TIME ZONE 'UTC') AS date,
        COALESCE(SUM(cm.input_tokens), 0)      AS input_tokens,
        COALESCE(SUM(cm.output_tokens), 0)     AS output_tokens
      FROM chat_messages cm
      INNER JOIN chat_sessions cs ON cs.id = cm.session_id
      WHERE cs.user_id = ${userId}
        AND cm.role = 'assistant'
        AND cm.created_at >= NOW() - (${days} || ' days')::interval
      GROUP BY DATE(cm.created_at AT TIME ZONE 'UTC')
      ORDER BY date ASC
    `);

    // embedding tokens은 날짜별 문서 업로드 기준
    const embRows = await this.drizzle.db.execute<{
      date: string;
      embedding_tokens: string;
    }>(sql`
      SELECT
        DATE(d.created_at AT TIME ZONE 'UTC') AS date,
        COALESCE(SUM(d.embedding_tokens), 0)  AS embedding_tokens
      FROM documents d
      INNER JOIN workspaces w ON w.id = d.workspace_id
      WHERE w.owner_id = ${userId}
        AND d.created_at >= NOW() - (${days} || ' days')::interval
      GROUP BY DATE(d.created_at AT TIME ZONE 'UTC')
    `);

    const embMap = new Map<string, number>();
    for (const r of embRows) {
      embMap.set(r.date, Number(r.embedding_tokens));
    }

    return rows.map((row) => {
      const inp = Number(row.input_tokens);
      const out = Number(row.output_tokens);
      const emb = embMap.get(row.date) ?? 0;
      return {
        date: row.date,
        inputTokens: inp,
        outputTokens: out,
        embeddingTokens: emb,
        costUsd: estimateCost('unknown', inp, out),
      };
    });
  }

  async getSessions(
    userId: string,
    workspaceId?: string,
    limit = 20,
  ): Promise<SessionUsage[]> {
    const workspaceFilter = workspaceId
      ? sql`AND cs.workspace_id = ${workspaceId}`
      : sql``;

    const rows = await this.drizzle.db.execute<{
      session_id: string;
      workspace_id: string;
      workspace_name: string;
      created_at: string;
      message_count: string;
      input_tokens: string;
      output_tokens: string;
    }>(sql`
      SELECT
        cs.id                                          AS session_id,
        cs.workspace_id,
        w.name                                         AS workspace_name,
        cs.created_at,
        COUNT(cm.id)                                   AS message_count,
        COALESCE(SUM(cm.input_tokens), 0)             AS input_tokens,
        COALESCE(SUM(cm.output_tokens), 0)            AS output_tokens
      FROM chat_sessions cs
      INNER JOIN workspaces w ON w.id = cs.workspace_id
      LEFT JOIN chat_messages cm ON cm.session_id = cs.id AND cm.role = 'assistant'
      WHERE cs.user_id = ${userId}
        ${workspaceFilter}
      GROUP BY cs.id, cs.workspace_id, w.name, cs.created_at
      ORDER BY cs.created_at DESC
      LIMIT ${limit}
    `);

    return rows.map((row) => {
      const inp = Number(row.input_tokens);
      const out = Number(row.output_tokens);
      return {
        sessionId: row.session_id,
        workspaceId: row.workspace_id,
        workspaceName: row.workspace_name,
        createdAt: row.created_at,
        messageCount: Number(row.message_count),
        inputTokens: inp,
        outputTokens: out,
        costUsd: estimateCost('unknown', inp, out),
      };
    });
  }
}
