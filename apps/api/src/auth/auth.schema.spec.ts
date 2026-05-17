import { RegisterSchema, LoginSchema } from '@comit/shared';

describe('RegisterSchema', () => {
  it('유효한 이메일과 8자 이상 비밀번호는 통과한다', () => {
    const result = RegisterSchema.safeParse({
      email: 'user@example.com',
      password: 'password1',
    });
    expect(result.success).toBe(true);
  });

  it('이메일 형식이 아니면 실패한다', () => {
    const result = RegisterSchema.safeParse({
      email: 'not-an-email',
      password: 'password1',
    });
    expect(result.success).toBe(false);
  });

  it('비밀번호가 8자 미만이면 실패한다', () => {
    const result = RegisterSchema.safeParse({
      email: 'user@example.com',
      password: '1234567',
    });
    expect(result.success).toBe(false);
  });

  it('빈 이메일은 실패한다', () => {
    const result = RegisterSchema.safeParse({
      email: '',
      password: 'password1',
    });
    expect(result.success).toBe(false);
  });

  it('빈 비밀번호는 실패한다', () => {
    const result = RegisterSchema.safeParse({
      email: 'user@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('LoginSchema', () => {
  it('유효한 이메일과 비밀번호는 통과한다', () => {
    const result = LoginSchema.safeParse({
      email: 'user@example.com',
      password: 'any',
    });
    expect(result.success).toBe(true);
  });

  it('이메일 형식이 아니면 실패한다', () => {
    const result = LoginSchema.safeParse({
      email: 'notvalid',
      password: 'any',
    });
    expect(result.success).toBe(false);
  });

  it('비밀번호가 빈 문자열이면 실패한다', () => {
    const result = LoginSchema.safeParse({
      email: 'user@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});
