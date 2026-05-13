export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface DocumentResponse {
  id: string;
  workspaceId: string;
  filename: string;
  status: DocumentStatus;
  fileSize: number;
  createdAt: string;
}

export interface Citation {
  chunkId: string;
  documentId: string;
  filename: string;
  excerpt: string;
}
