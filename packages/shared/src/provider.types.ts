export type AiProvider = 'openai' | 'anthropic' | 'gemini';

export interface CreateProviderDto {
  provider: AiProvider;
  apiKey: string;
  model: string;
}

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
