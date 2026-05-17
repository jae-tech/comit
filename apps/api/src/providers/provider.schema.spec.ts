import { CreateProviderSchema } from '@comit/shared';

describe('CreateProviderSchema', () => {
  it('유효한 provider, apiKey, model은 통과한다', () => {
    const result = CreateProviderSchema.safeParse({
      provider: 'openai',
      apiKey: 'sk-test-key',
      model: 'gpt-4o',
    });
    expect(result.success).toBe(true);
  });

  it('provider가 enum 외 값이면 실패한다', () => {
    const result = CreateProviderSchema.safeParse({
      provider: 'unknown',
      apiKey: 'sk-test-key',
      model: 'gpt-4o',
    });
    expect(result.success).toBe(false);
  });

  it('세 가지 유효한 provider를 모두 허용한다', () => {
    for (const provider of ['openai', 'anthropic', 'gemini'] as const) {
      const result = CreateProviderSchema.safeParse({
        provider,
        apiKey: 'test-key',
        model: 'some-model',
      });
      expect(result.success).toBe(true);
    }
  });

  it('apiKey가 빈 문자열이면 실패한다', () => {
    const result = CreateProviderSchema.safeParse({
      provider: 'openai',
      apiKey: '',
      model: 'gpt-4o',
    });
    expect(result.success).toBe(false);
  });

  it('model이 빈 문자열이면 실패한다', () => {
    const result = CreateProviderSchema.safeParse({
      provider: 'openai',
      apiKey: 'sk-test-key',
      model: '',
    });
    expect(result.success).toBe(false);
  });
});
