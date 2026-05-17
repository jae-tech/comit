import { DemoChatSchema, DemoSettingsSchema, AddPersonaSchema } from './demo.dto';

describe('DemoChatSchema', () => {
  it('1자 이상 2000자 이하 question은 통과한다', () => {
    const result = DemoChatSchema.safeParse({ question: '안녕' });
    expect(result.success).toBe(true);
  });

  it('question이 빈 문자열이면 실패한다', () => {
    const result = DemoChatSchema.safeParse({ question: '' });
    expect(result.success).toBe(false);
  });

  it('question이 2000자를 초과하면 실패한다', () => {
    const result = DemoChatSchema.safeParse({ question: 'a'.repeat(2001) });
    expect(result.success).toBe(false);
  });

  it('sessionId는 optional이다', () => {
    const result = DemoChatSchema.safeParse({ question: '질문' });
    expect(result.success).toBe(true);
  });

  it('sessionId가 있어도 통과한다', () => {
    const result = DemoChatSchema.safeParse({
      question: '질문',
      sessionId: 'some-session-id',
    });
    expect(result.success).toBe(true);
  });
});

describe('AddPersonaSchema', () => {
  it('name과 prompt가 모두 있으면 통과한다', () => {
    const result = AddPersonaSchema.safeParse({
      name: '어시스턴트',
      prompt: '당신은 도움이 되는 AI입니다.',
    });
    expect(result.success).toBe(true);
  });

  it('name이 빈 문자열이면 실패한다', () => {
    const result = AddPersonaSchema.safeParse({
      name: '',
      prompt: '프롬프트',
    });
    expect(result.success).toBe(false);
  });

  it('prompt가 빈 문자열이면 실패한다', () => {
    const result = AddPersonaSchema.safeParse({
      name: '이름',
      prompt: '',
    });
    expect(result.success).toBe(false);
  });

  it('name이 100자를 초과하면 실패한다', () => {
    const result = AddPersonaSchema.safeParse({
      name: 'a'.repeat(101),
      prompt: '프롬프트',
    });
    expect(result.success).toBe(false);
  });
});

describe('DemoSettingsSchema', () => {
  it('모든 필드가 optional이라 빈 객체도 통과한다', () => {
    const result = DemoSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('personaName이 100자를 초과하면 실패한다', () => {
    const result = DemoSettingsSchema.safeParse({
      personaName: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
  });
});
