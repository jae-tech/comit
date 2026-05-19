import { RegisterSchema, LoginSchema } from '@comit/shared';

describe('RegisterSchema', () => {
  it('유효한 username과 8자 이상 비밀번호는 통과한다', () => {
    const result = RegisterSchema.safeParse({
      username: 'valid_user',
      password: 'password1',
    });
    expect(result.success).toBe(true);
  });

  it('허용되지 않는 문자가 포함된 username은 실패한다', () => {
    const result = RegisterSchema.safeParse({
      username: 'user@example.com',
      password: 'password1',
    });
    expect(result.success).toBe(false);
  });

  it('비밀번호가 8자 미만이면 실패한다', () => {
    const result = RegisterSchema.safeParse({
      username: 'validuser',
      password: '1234567',
    });
    expect(result.success).toBe(false);
  });

  it('빈 username은 실패한다', () => {
    const result = RegisterSchema.safeParse({
      username: '',
      password: 'password1',
    });
    expect(result.success).toBe(false);
  });

  it('빈 비밀번호는 실패한다', () => {
    const result = RegisterSchema.safeParse({
      username: 'validuser',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('LoginSchema', () => {
  it('유효한 username과 비밀번호는 통과한다', () => {
    const result = LoginSchema.safeParse({
      username: 'validuser',
      password: 'any',
    });
    expect(result.success).toBe(true);
  });

  it('빈 username은 실패한다', () => {
    const result = LoginSchema.safeParse({
      username: '',
      password: 'any',
    });
    expect(result.success).toBe(false);
  });

  it('비밀번호가 빈 문자열이면 실패한다', () => {
    const result = LoginSchema.safeParse({
      username: 'validuser',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});
