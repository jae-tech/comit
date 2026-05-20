import { vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from '@/common/guards/admin.guard';
import { DrizzleService } from '@/database/drizzle.service';

const mockDrizzle = () => ({
  db: {
    execute: vi.fn(),
    select: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  },
});

function makeExecuteMock(summary: object, userRows: object[]) {
  let callCount = 0;
  return vi.fn().mockImplementation(() => {
    callCount++;
    if (callCount === 1) return Promise.resolve([summary]);
    return Promise.resolve(userRows);
  });
}

describe('AdminService', () => {
  let service: AdminService;
  let drizzle: ReturnType<typeof mockDrizzle>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: DrizzleService, useFactory: mockDrizzle },
      ],
    }).compile();

    service = module.get(AdminService);
    drizzle = module.get(DrizzleService) as ReturnType<typeof mockDrizzle>;
  });

  describe('getStats()', () => {
    it('집계 결과를 올바른 타입으로 반환한다', async () => {
      const summary = {
        total_users: '3',
        active_users_30d: '2',
        total_sessions: '10',
        total_messages: '25',
        total_input_tokens: '5000',
        total_output_tokens: '3000',
      };
      const userRow = {
        user_id: 'uuid-1',
        username: 'alice',
        is_active: true,
        session_count: '4',
        message_count: '12',
        input_tokens: '2000',
        output_tokens: '1500',
        model: 'gpt-4o',
        last_activity_at: '2026-05-01T00:00:00Z',
      };
      drizzle.db.execute = makeExecuteMock(summary, [userRow]);

      const result = await service.getStats();

      expect(result.totalUsers).toBe(3);
      expect(result.activeUsers30d).toBe(2);
      expect(result.byUser).toHaveLength(1);
      expect(result.byUser[0].username).toBe('alice');
      expect(result.byUser[0].inputTokens).toBe(2000);
      expect(result.byUser[0].isActive).toBe(true);
    });

    it('유저가 없으면 byUser는 빈 배열이다', async () => {
      const summary = {
        total_users: '0',
        active_users_30d: '0',
        total_sessions: '0',
        total_messages: '0',
        total_input_tokens: '0',
        total_output_tokens: '0',
      };
      drizzle.db.execute = makeExecuteMock(summary, []);

      const result = await service.getStats();
      expect(result.byUser).toHaveLength(0);
      expect(result.estimatedCostUsd).toBe(0);
    });
  });

  describe('getKeywords()', () => {
    it('질문 목록과 카운트를 반환한다', async () => {
      const rows = [
        {
          content: '요약해줘',
          count: '5',
          last_used_at: '2026-05-10T12:00:00Z',
        },
        {
          content: '번역해줘',
          count: '3',
          last_used_at: '2026-05-09T10:00:00Z',
        },
      ];
      drizzle.db.execute = vi.fn().mockResolvedValue(rows);

      const result = await service.getKeywords();

      expect(result.total).toBe(2);
      expect(result.items[0].content).toBe('요약해줘');
      expect(result.items[0].count).toBe(5);
    });

    it('메시지가 없으면 빈 목록을 반환한다', async () => {
      drizzle.db.execute = vi.fn().mockResolvedValue([]);

      const result = await service.getKeywords();
      expect(result.total).toBe(0);
      expect(result.items).toHaveLength(0);
    });
  });

  describe('deleteUser()', () => {
    function makeSelectChain(rows: object[]) {
      const chain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(rows),
      };
      return chain;
    }

    function makeDeleteChain() {
      return {
        where: vi.fn().mockResolvedValue(undefined),
      };
    }

    it('일반 유저를 삭제한다', async () => {
      drizzle.db.select = vi.fn().mockReturnValue(
        makeSelectChain([{ id: 'u1', role: 'user', isActive: true }]),
      );
      drizzle.db.delete = vi.fn().mockReturnValue(makeDeleteChain());

      await expect(service.deleteUser('u1')).resolves.toBeUndefined();
      expect(drizzle.db.delete).toHaveBeenCalled();
    });

    it('존재하지 않는 유저면 NotFoundException을 던진다', async () => {
      drizzle.db.select = vi.fn().mockReturnValue(makeSelectChain([]));

      await expect(service.deleteUser('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('admin 유저는 삭제할 수 없다 (ForbiddenException)', async () => {
      drizzle.db.select = vi.fn().mockReturnValue(
        makeSelectChain([{ id: 'a1', role: 'admin', isActive: true }]),
      );

      await expect(service.deleteUser('a1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('setUserActive()', () => {
    function makeSelectChain(rows: object[]) {
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(rows),
      };
    }

    function makeUpdateChain() {
      return {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };
    }

    it('유저를 비활성화한다', async () => {
      drizzle.db.select = vi.fn().mockReturnValue(
        makeSelectChain([{ id: 'u1', role: 'user', isActive: true }]),
      );
      drizzle.db.update = vi.fn().mockReturnValue(makeUpdateChain());

      await expect(service.setUserActive('u1', false)).resolves.toBeUndefined();
      expect(drizzle.db.update).toHaveBeenCalled();
    });

    it('존재하지 않는 유저면 NotFoundException을 던진다', async () => {
      drizzle.db.select = vi.fn().mockReturnValue(makeSelectChain([]));

      await expect(service.setUserActive('unknown', false)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('admin 유저는 비활성화할 수 없다', async () => {
      drizzle.db.select = vi.fn().mockReturnValue(
        makeSelectChain([{ id: 'a1', role: 'admin', isActive: true }]),
      );

      await expect(service.setUserActive('a1', false)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('changeUserPassword()', () => {
    function makeSelectChain(rows: object[]) {
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(rows),
      };
    }

    function makeUpdateChain() {
      return {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };
    }

    it('비밀번호를 bcrypt 해시로 변경한다', async () => {
      drizzle.db.select = vi.fn().mockReturnValue(
        makeSelectChain([{ id: 'u1', role: 'user', isActive: true }]),
      );
      drizzle.db.update = vi.fn().mockReturnValue(makeUpdateChain());

      await expect(
        service.changeUserPassword('u1', 'newpassword123'),
      ).resolves.toBeUndefined();
      expect(drizzle.db.update).toHaveBeenCalled();
    });

    it('존재하지 않는 유저면 NotFoundException을 던진다', async () => {
      drizzle.db.select = vi.fn().mockReturnValue(makeSelectChain([]));

      await expect(
        service.changeUserPassword('unknown', 'newpassword123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('admin 비밀번호는 변경할 수 없다', async () => {
      drizzle.db.select = vi.fn().mockReturnValue(
        makeSelectChain([{ id: 'a1', role: 'admin', isActive: true }]),
      );

      await expect(
        service.changeUserPassword('a1', 'newpassword123'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

describe('AdminGuard', () => {
  const guard = new AdminGuard();

  function makeCtx(role: string | undefined) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user:
            role !== undefined ? { id: 'u1', username: 'u', role } : undefined,
        }),
      }),
    } as never;
  }

  it('admin 역할이면 통과한다', () => {
    expect(guard.canActivate(makeCtx('admin'))).toBe(true);
  });

  it('일반 유저면 ForbiddenException을 던진다', () => {
    expect(() => guard.canActivate(makeCtx('user'))).toThrow(
      ForbiddenException,
    );
  });

  it('user가 없으면 ForbiddenException을 던진다', () => {
    expect(() => guard.canActivate(makeCtx(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
