export interface WorkspaceResponse {
  id: string;
  name: string;
  personaName: string | null;
  systemPrompt: string | null;
  createdAt: string;
}

export interface UpdateWorkspaceDto {
  personaName?: string;
  systemPrompt?: string;
}
