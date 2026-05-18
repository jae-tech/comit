import { z } from 'zod';
import type { Citation } from '@comit/shared';

const searchSchema = z.object({
  query: z.string().min(1).max(500),
});

type RetrieveFn = (
  workspaceId: string,
  query: string,
  apiKey: string,
  provider: string,
) => Promise<Citation[]>;

export interface DocumentSearchResult {
  citations: Citation[];
  query: string;
}

export function makeDocumentSearchTool(
  retrieveContext: RetrieveFn,
  workspaceId: string,
  apiKey: string,
  provider: string,
) {
  return {
    name: 'document_search',
    description:
      'Search the workspace documents for relevant information. Use this when the current context is insufficient to answer the question.',
    parameters: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'The search query to find relevant document chunks',
        },
      },
      required: ['query'],
    },
    execute: async (input: unknown): Promise<DocumentSearchResult> => {
      const parsed = searchSchema.safeParse(input);
      if (!parsed.success) {
        return { citations: [], query: '' };
      }
      const citations = await retrieveContext(
        workspaceId,
        parsed.data.query,
        apiKey,
        provider,
      );
      return { citations, query: parsed.data.query };
    },
  };
}
