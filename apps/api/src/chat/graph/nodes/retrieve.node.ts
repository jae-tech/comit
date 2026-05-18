import type { Subject } from 'rxjs';
import type { Citation } from '@comit/shared';
import type { RagState } from '../rag-state';

export async function retrieveNode(
  state: RagState,
  subject: Subject<MessageEvent>,
  retrieveContext: (
    workspaceId: string,
    query: string,
    apiKey: string,
    provider: string,
  ) => Promise<Citation[]>,
  apiKey: string,
  provider: string,
): Promise<Partial<RagState>> {
  subject.next({
    data: JSON.stringify({ type: 'thinking', step: 'retrieve' }),
  } as MessageEvent);

  const citations = await retrieveContext(
    state.workspaceId,
    state.rewrittenQuery,
    apiKey,
    provider,
  );

  return { citations };
}
