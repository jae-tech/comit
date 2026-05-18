import { z } from 'zod';

export const UpdateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  personaName: z.string().max(100).optional(),
  systemPrompt: z.string().max(2000).optional(),
});

export const SetActiveProviderSchema = z.object({
  providerId: z.string().uuid(),
});

export type UpdateWorkspaceDto = z.infer<typeof UpdateWorkspaceSchema>;
export type SetActiveProviderDto = z.infer<typeof SetActiveProviderSchema>;

export interface WorkspaceResponse {
  id: string;
  name: string;
  personaName: string | null;
  systemPrompt: string | null;
  activeProviderId: string | null;
  createdAt: string;
}
