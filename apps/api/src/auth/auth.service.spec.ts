import { vi } from 'vitest';
import { Test } from '@nestjs/testing';
import {
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { DrizzleService } from '@/database/drizzle.service';

const mockDrizzle = () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
});

const mockJwt = () => ({
  sign: vi.fn().mockReturnValue('mock-token'),
  verify: vi.fn(),
});

const mockConfig = () => ({
  get: vi.fn().mockReturnValue('7d'),
});

const mockRedis = () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
});

function makeSelectChain(rows: object[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let drizzle: ReturnType<typeof mockDrizzle>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DrizzleService, useFactory: mockDrizzle },
        { provide: JwtService, useFactory: mockJwt },
        { provide: ConfigService, useFactory: mockConfig },
        { provide: 'default_IORedisModuleConnectionToken', useFactory: mockRedis },
      ],
    }).compile();

    service = module.get(AuthService);
    drizzle = module.get(DrizzleService) as ReturnType<typeof mockDrizzle>;
  });

  describe('login()', () => {
    it('isActive=false인 계정은 ForbiddenException을 던진다', async () => {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('password1', 1);

      drizzle.db.select = vi.fn().mockReturnValue(
        makeSelectChain([
          {
            id: 'u1',
            username: 'alice',
            passwordHash: hash,
            isActive: false,
            role: 'user',
          },
        ]),
      );

      await expect(
        service.login({ username: 'alice', password: 'password1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('isActive=true인 계정은 토큰을 반환한다', async () => {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('password1', 1);

      drizzle.db.select = vi.fn().mockReturnValue(
        makeSelectChain([
          {
            id: 'u1',
            username: 'alice',
            passwordHash: hash,
            isActive: true,
            role: 'user',
          },
        ]),
      );

      const result = await service.login({ username: 'alice', password: 'password1' });
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('존재하지 않는 유저면 UnauthorizedException을 던진다', async () => {
      drizzle.db.select = vi.fn().mockReturnValue(makeSelectChain([]));

      await expect(
        service.login({ username: 'nobody', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('비밀번호 불일치 시 UnauthorizedException을 던진다', async () => {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('correct', 1);

      drizzle.db.select = vi.fn().mockReturnValue(
        makeSelectChain([
          { id: 'u1', username: 'alice', passwordHash: hash, isActive: true, role: 'user' },
        ]),
      );

      await expect(
        service.login({ username: 'alice', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register()', () => {
    it('이미 존재하는 username이면 ConflictException을 던진다', async () => {
      drizzle.db.select = vi.fn().mockReturnValue(
        makeSelectChain([{ id: 'existing' }]),
      );

      await expect(
        service.register({ username: 'alice', password: 'password1' }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
