import { vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { Document } from '../database/entities/document.entity';
import { DocumentChunk } from '../database/entities/document-chunk.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { EMBEDDING_QUEUE } from './constants';

const mockDocumentRepo = () => ({
  findBy: vi.fn(),
  findOneBy: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
});

const mockChunkRepo = () => ({});

const mockQueue = () => ({ add: vi.fn() });

const mockWorkspacesService = () => ({
  findOne: vi.fn(),
});

describe('DocumentsService — workspace 소유권 검증', () => {
  let service: DocumentsService;
  let workspacesService: ReturnType<typeof mockWorkspacesService>;
  let documentRepo: ReturnType<typeof mockDocumentRepo>;

  const OWNER_ID = 'user-owner-uuid';
  const OTHER_USER_ID = 'user-other-uuid';
  const WORKSPACE_ID = 'ws-uuid';

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: getRepositoryToken(Document), useFactory: mockDocumentRepo },
        { provide: getRepositoryToken(DocumentChunk), useFactory: mockChunkRepo },
        { provide: getQueueToken(EMBEDDING_QUEUE), useFactory: mockQueue },
        { provide: WorkspacesService, useFactory: mockWorkspacesService },
      ],
    }).compile();

    service = module.get(DocumentsService);
    workspacesService = module.get(WorkspacesService);
    documentRepo = module.get(getRepositoryToken(Document));
  });

  describe('findAll()', () => {
    it('소유자는 문서 목록을 조회할 수 있어야 한다', async () => {
      workspacesService.findOne.mockResolvedValue({ id: WORKSPACE_ID, ownerId: OWNER_ID });
      documentRepo.findBy.mockResolvedValue([]);

      await expect(service.findAll(WORKSPACE_ID, OWNER_ID)).resolves.toEqual([]);
      expect(workspacesService.findOne).toHaveBeenCalledWith(WORKSPACE_ID, OWNER_ID);
    });

    it('비소유자가 접근하면 ForbiddenException이 발생해야 한다', async () => {
      workspacesService.findOne.mockRejectedValue(new ForbiddenException());

      await expect(service.findAll(WORKSPACE_ID, OTHER_USER_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findOne()', () => {
    it('소유자는 문서를 조회할 수 있어야 한다', async () => {
      const doc = { id: 'doc-1', workspaceId: WORKSPACE_ID };
      workspacesService.findOne.mockResolvedValue({ id: WORKSPACE_ID });
      documentRepo.findOneBy.mockResolvedValue(doc);

      await expect(service.findOne('doc-1', WORKSPACE_ID, OWNER_ID)).resolves.toEqual(doc);
    });

    it('비소유자가 접근하면 ForbiddenException이 발생해야 한다', async () => {
      workspacesService.findOne.mockRejectedValue(new ForbiddenException());

      await expect(service.findOne('doc-1', WORKSPACE_ID, OTHER_USER_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('존재하지 않는 문서는 NotFoundException이 발생해야 한다', async () => {
      workspacesService.findOne.mockResolvedValue({ id: WORKSPACE_ID });
      documentRepo.findOneBy.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', WORKSPACE_ID, OWNER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove()', () => {
    it('비소유자가 삭제 시도하면 ForbiddenException이 발생해야 한다', async () => {
      workspacesService.findOne.mockRejectedValue(new ForbiddenException());

      await expect(service.remove('doc-1', WORKSPACE_ID, OTHER_USER_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
