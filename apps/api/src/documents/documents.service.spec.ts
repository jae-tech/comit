import { vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { ForbiddenException } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { WorkspacesService } from '@/workspaces/workspaces.service';
import { DrizzleService } from '@/database/drizzle.service';
import { EMBEDDING_QUEUE } from './constants';

const mockDrizzle = () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockReturnThis(),
  },
});

const mockQueue = () => ({ add: vi.fn() });

const mockWorkspacesService = () => ({
  findOne: vi.fn(),
});

describe('DocumentsService — workspace 소유권 검증', () => {
  let service: DocumentsService;
  let workspacesService: ReturnType<typeof mockWorkspacesService>;
  let drizzle: ReturnType<typeof mockDrizzle>;

  const OWNER_ID = 'user-owner-uuid';
  const OTHER_USER_ID = 'user-other-uuid';
  const WORKSPACE_ID = 'ws-uuid';

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: DrizzleService, useFactory: mockDrizzle },
        { provide: getQueueToken(EMBEDDING_QUEUE), useFactory: mockQueue },
        { provide: WorkspacesService, useFactory: mockWorkspacesService },
      ],
    }).compile();

    service = module.get(DocumentsService);
    workspacesService = module.get(WorkspacesService);
    drizzle = module.get(DrizzleService);
  });

  describe('findAll()', () => {
    it('소유자는 문서 목록을 조회할 수 있어야 한다', async () => {
      workspacesService.findOne.mockResolvedValue({
        id: WORKSPACE_ID,
        ownerId: OWNER_ID,
      });

      drizzle.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      await expect(service.findAll(WORKSPACE_ID, OWNER_ID)).resolves.toEqual(
        [],
      );
      expect(workspacesService.findOne).toHaveBeenCalledWith(
        WORKSPACE_ID,
        OWNER_ID,
      );
    });

    it('비소유자가 접근하면 ForbiddenException이 발생해야 한다', async () => {
      workspacesService.findOne.mockRejectedValue(new ForbiddenException());

      await expect(
        service.findAll(WORKSPACE_ID, OTHER_USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove()', () => {
    it('비소유자가 삭제 시도하면 ForbiddenException이 발생해야 한다', async () => {
      workspacesService.findOne.mockRejectedValue(new ForbiddenException());

      await expect(
        service.remove('doc-1', WORKSPACE_ID, OTHER_USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
