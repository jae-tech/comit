// $/1M 토큰 기준 (2025-05 공식 단가)
export const MODEL_PRICING: Record<string, { input: number; output: number }> =
  {
    'gpt-4o': { input: 2.5, output: 10.0 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'gpt-4-turbo': { input: 10.0, output: 30.0 },
    'gemini-2.5-flash': { input: 0.15, output: 0.6 },
    'gemini-2.5-pro': { input: 1.25, output: 5.0 },
    'claude-3-5-sonnet': { input: 3.0, output: 15.0 },
    'claude-3-7-sonnet': { input: 3.0, output: 15.0 },
    'claude-opus-4': { input: 15.0, output: 75.0 },
  };

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = MODEL_PRICING[model] ?? { input: 0, output: 0 };
  return (
    (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
  );
}
