import { eq, and, desc } from 'drizzle-orm';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import type { DrizzleService } from '@/database/drizzle.service';
import { chatMessages } from '@/database/schema';
import type { RagState } from '../rag-state';

const HISTORY_LIMIT = 10;

export async function loadHistoryNode(
  state: RagState,
  drizzle: DrizzleService,
): Promise<Partial<RagState>> {
  if (!state.sessionId) {
    return { history: [] };
  }

  const rows = await drizzle.db
    .select({
      role: chatMessages.role,
      content: chatMessages.content,
    })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.sessionId, state.sessionId),
      ),
    )
    .orderBy(desc(chatMessages.createdAt))
    .limit(HISTORY_LIMIT);

  // 최신 → 오래된 순으로 조회했으므로 역순으로 되돌림
  const history = rows
    .reverse()
    .map((row) =>
      row.role === 'user'
        ? new HumanMessage(row.content)
        : new AIMessage(row.content),
    );

  return { history };
}
