import { ChatQuerySchema } from '@comit/shared';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('ChatQuerySchema', () => {
  it('유효한 UUID workspaceId와 question은 통과한다', () => {
    const result = ChatQuerySchema.safeParse({
      workspaceId: VALID_UUID,
      question: '안녕하세요',
    });
    expect(result.success).toBe(true);
  });

  it('workspaceId가 UUID 형식이 아니면 실패한다', () => {
    const result = ChatQuerySchema.safeParse({
      workspaceId: 'not-a-uuid',
      question: '안녕하세요',
    });
    expect(result.success).toBe(false);
  });

  it('question이 빈 문자열이면 실패한다', () => {
    const result = ChatQuerySchema.safeParse({
      workspaceId: VALID_UUID,
      question: '',
    });
    expect(result.success).toBe(false);
  });

  it('sessionId가 없어도 통과한다', () => {
    const result = ChatQuerySchema.safeParse({
      workspaceId: VALID_UUID,
      question: '질문',
    });
    expect(result.success).toBe(true);
  });

  it('sessionId가 유효한 UUID이면 통과한다', () => {
    const result = ChatQuerySchema.safeParse({
      workspaceId: VALID_UUID,
      sessionId: VALID_UUID,
      question: '질문',
    });
    expect(result.success).toBe(true);
  });

  it('sessionId가 UUID 형식이 아니면 실패한다', () => {
    const result = ChatQuerySchema.safeParse({
      workspaceId: VALID_UUID,
      sessionId: 'not-a-uuid',
      question: '질문',
    });
    expect(result.success).toBe(false);
  });
});
