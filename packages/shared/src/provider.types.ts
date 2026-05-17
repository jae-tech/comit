import { z } from 'zod';

export const AiProviderEnum = z.enum(['openai', 'anthropic', 'gemini']);
export type AiProvider = z.infer<typeof AiProviderEnum>;

export const CreateProviderSchema = z.object({
  provider: AiProviderEnum,
  apiKey: z.string().min(1),
  model: z.string().min(1),
});

export const UpdateProviderSchema = z.object({
  provider: AiProviderEnum.optional(),
  apiKey: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
});

export type CreateProviderDto = z.infer<typeof CreateProviderSchema>;
export type UpdateProviderDto = z.infer<typeof UpdateProviderSchema>;

export interface ProviderResponse {
  id: string;
  provider: AiProvider;
  model: string;
  createdAt: string;
  // apiKey는 절대 응답에 포함하지 않음
}

export interface ModelInfo {
  id: string;
  name: string;
}

export interface ModelsResponse {
  provider: AiProvider;
  models: ModelInfo[];
}
