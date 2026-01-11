/**
 * FoldersService Unit Tests
 *
 * Tests for folder management operations including CRUD, hierarchical operations,
 * path management, tree building, and breadcrumb generation.
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';

import { FoldersService } from '../folders.service';

// Types for mocks
type MockPrismaFolder = {
  create: Mock;
  findMany: Mock;
  findFirst: Mock;
  findUnique: Mock;
  update: Mock;
  delete: Mock;
  count: Mock;
};

type MockPrismaDocument = {
  count: Mock;
};

interface MockPrisma {
  folder: MockPrismaFolder;
  document: MockPrismaDocument;
}

interface MockRealtime {
  emitFolderCreated: Mock;
  emitFolderUpdated: Mock;
  emitFolderDeleted: Mock;
}

// Test fixtures
const mockOrganizationId = '550e8400-e29b-41d4-a716-446655440000';
const mockUserId = '660e8400-e29b-41d4-a716-446655440001';
const mockFolderId = '770e8400-e29b-41d4-a716-446655440002';
const mockParentFolderId = '880e8400-e29b-41d4-a716-446655440003';

const mockUser = {
  id: mockUserId,
  name: 'Test User',
  email: 'test@example.com',
};

const mockFolder = {
  id: mockFolderId,
  organizationId: mockOrganizationId,
  parentId: null,
  name: 'Test Folder',
  path: '/Test Folder',
  depth: 0,
  createdById: mockUserId,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

const mockParentFolder = {
  id: mockParentFolderId,
  organizationId: mockOrganizationId,
  parentId: null,
  name: 'Parent Folder',
  path: '/Parent Folder',
  depth: 0,
  createdById: mockUserId,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

describe('FoldersService', () => {
  let service: FoldersService;
  let mockPrisma: MockPrisma;
  let mockRealtime: MockRealtime;

  beforeEach(() => {
    // Create fresh mocks for each test
    mockPrisma = {
      folder: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      document: {
        count: vi.fn(),
      },
    };

    mockRealtime = {
      emitFolderCreated: vi.fn(),
      emitFolderUpdated: vi.fn(),
      emitFolderDeleted: vi.fn(),
    };

    // Create service instance with mocks (direct instantiation like DocumentsService test)
    service = new FoldersService(
      mockPrisma as any,
      mockRealtime as any,
    );
  });

  describe('create', () => {
    const createInput = {
      name: 'New Folder',
      organizationId: mockOrganizationId,
      createdById: mockUserId,
    };

    it('should create root folder with correct path', async () => {
      const expectedFolder = {
        ...mockFolder,
        name: createInput.name,
        path: `/${createInput.name}`,
        createdBy: mockUser,
      };

      mockPrisma.folder.create.mockResolvedValue(expectedFolder);

      const result = await service.create(createInput);

      expect(result.name).toBe(createInput.name);
      expect(result.path).toBe(`/${createInput.name}`);
      expect(mockPrisma.folder.create).toHaveBeenCalledWith({
        data: {
          name: createInput.name,
          path: `/${createInput.name}`,
          organizationId: createInput.organizationId,
          parentId: undefined,
          createdById: createInput.createdById,
        },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    });

    it('should create nested folder with parent path', async () => {
      const inputWithParent = {
        ...createInput,
        parentId: mockParentFolderId,
      };

      mockPrisma.folder.findFirst.mockResolvedValue(mockParentFolder);
      mockPrisma.folder.create.mockResolvedValue({
        ...mockFolder,
        parentId: mockParentFolderId,
        path: '/Parent Folder/New Folder',
        createdBy: mockUser,
      });

      const result = await service.create(inputWithParent);

      expect(result.path).toBe('/Parent Folder/New Folder');
      expect(mockPrisma.folder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          path: '/Parent Folder/New Folder',
          parentId: mockParentFolderId,
        }),
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException when parent folder not found', async () => {
      const inputWithInvalidParent = {
        ...createInput,
        parentId: 'non-existent-parent',
      };

      mockPrisma.folder.findFirst.mockResolvedValue(null);

      await expect(service.create(inputWithInvalidParent)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when parent is in different organization', async () => {
      const inputWithParent = {
        ...createInput,
        parentId: mockParentFolderId,
      };

      mockPrisma.folder.findFirst.mockResolvedValue(null);

      await expect(service.create(inputWithParent)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockPrisma.folder.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockParentFolderId,
          organizationId: mockOrganizationId,
        },
      });
    });
  });

  describe('findAll', () => {
    it('should return root folders when no parentId provided', async () => {
      const folders = [mockFolder, { ...mockFolder, id: 'folder-2', name: 'Second' }];

      mockPrisma.folder.findMany.mockResolvedValue(
        folders.map((f) => ({
          ...f,
          _count: { children: 0, documents: 0 },
        })),
      );

      const result = await service.findAll(mockOrganizationId);

      expect(result).toHaveLength(2);
      expect(mockPrisma.folder.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: mockOrganizationId,
          parentId: null,
        },
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              children: true,
              documents: true,
            },
          },
        },
      });
    });

    it('should return child folders when parentId provided', async () => {
      mockPrisma.folder.findMany.mockResolvedValue([]);

      await service.findAll(mockOrganizationId, mockParentFolderId);

      expect(mockPrisma.folder.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: mockOrganizationId,
          parentId: mockParentFolderId,
        },
        orderBy: { name: 'asc' },
        include: expect.any(Object),
      });
    });

    it('should return folders sorted by name ascending', async () => {
      mockPrisma.folder.findMany.mockResolvedValue([]);

      await service.findAll(mockOrganizationId);

      expect(mockPrisma.folder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        }),
      );
    });

    it('should include children and document counts', async () => {
      const folderWithCounts = {
        ...mockFolder,
        _count: { children: 3, documents: 5 },
      };

      mockPrisma.folder.findMany.mockResolvedValue([folderWithCounts]);

      const result = await service.findAll(mockOrganizationId);

      expect(result[0]._count).toEqual({ children: 3, documents: 5 });
    });
  });

  describe('findOne', () => {
    it('should return folder with all relations', async () => {
      const folderWithRelations = {
        ...mockFolder,
        parent: null,
        children: [],
        documents: [],
        createdBy: mockUser,
      };

      mockPrisma.folder.findFirst.mockResolvedValue(folderWithRelations);

      const result = await service.findOne(mockFolderId, mockOrganizationId);

      expect(result).toEqual(folderWithRelations);
      expect(mockPrisma.folder.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockFolderId,
          organizationId: mockOrganizationId,
        },
        include: {
          parent: true,
          children: { orderBy: { name: 'asc' } },
          documents: {
            where: { status: { not: DocumentStatus.DELETED } },
            orderBy: { createdAt: 'desc' },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    });

    it('should throw NotFoundException when folder not found', async () => {
      mockPrisma.folder.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('non-existent-id', mockOrganizationId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce organization isolation', async () => {
      mockPrisma.folder.findFirst.mockResolvedValue(null);

      const differentOrgId = 'different-org-id';
      await expect(
        service.findOne(mockFolderId, differentOrgId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should exclude deleted documents from folder contents', async () => {
      mockPrisma.folder.findFirst.mockResolvedValue(mockFolder);

      await service.findOne(mockFolderId, mockOrganizationId);

      expect(mockPrisma.folder.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            documents: {
              where: { status: { not: DocumentStatus.DELETED } },
              orderBy: { createdAt: 'desc' },
            },
          }),
        }),
      );
    });
  });

  describe('update', () => {
    beforeEach(() => {
      mockPrisma.folder.findFirst.mockResolvedValue(mockFolder);
    });

    it('should update folder name and path', async () => {
      const updateInput = { name: 'Renamed Folder' };
      const updatedFolder = {
        ...mockFolder,
        name: updateInput.name,
        path: '/Renamed Folder',
      };

      mockPrisma.folder.update.mockResolvedValue(updatedFolder);

      const result = await service.update(mockFolderId, mockOrganizationId, updateInput);

      expect(result.name).toBe(updateInput.name);
      expect(result.path).toBe('/Renamed Folder');
    });

    it('should throw NotFoundException when folder not found', async () => {
      mockPrisma.folder.findFirst.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', mockOrganizationId, { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when moving folder into itself', async () => {
      await expect(
        service.update(mockFolderId, mockOrganizationId, { parentId: mockFolderId }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when target folder not found', async () => {
      mockPrisma.folder.findFirst
        .mockResolvedValueOnce(mockFolder) // First call for findOne
        .mockResolvedValueOnce(null); // Second call for target folder

      await expect(
        service.update(mockFolderId, mockOrganizationId, { parentId: 'non-existent' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update path when moving to new parent', async () => {
      const inputWithParent = { parentId: mockParentFolderId };

      mockPrisma.folder.findFirst
        .mockResolvedValueOnce(mockFolder)
        .mockResolvedValueOnce(mockParentFolder);

      mockPrisma.folder.update.mockResolvedValue({
        ...mockFolder,
        parentId: mockParentFolderId,
        path: '/Parent Folder/Test Folder',
        createdBy: mockUser,
      });

      const result = await service.update(mockFolderId, mockOrganizationId, inputWithParent);

      expect(result.path).toBe('/Parent Folder/Test Folder');
      expect(mockPrisma.folder.update).toHaveBeenCalledWith({
        where: { id: mockFolderId },
        data: expect.objectContaining({
          parentId: mockParentFolderId,
          path: '/Parent Folder/Test Folder',
        }),
        include: expect.any(Object),
      });
    });

    it('should update path when moving to root', async () => {
      const nestedFolder = {
        ...mockFolder,
        parentId: mockParentFolderId,
        path: '/Parent Folder/Test Folder',
      };

      mockPrisma.folder.findFirst.mockResolvedValue(nestedFolder);
      mockPrisma.folder.update.mockResolvedValue({
        ...nestedFolder,
        parentId: null,
        path: '/Test Folder',
      });

      const result = await service.update(mockFolderId, mockOrganizationId, { parentId: null });

      expect(result.path).toBe('/Test Folder');
    });

    it('should update path correctly when renaming nested folder', async () => {
      const nestedFolder = {
        ...mockFolder,
        parentId: mockParentFolderId,
        path: '/Parent Folder/Test Folder',
      };

      mockPrisma.folder.findFirst.mockResolvedValue(nestedFolder);
      mockPrisma.folder.update.mockResolvedValue({
        ...nestedFolder,
        name: 'Renamed',
        path: '/Parent Folder/Renamed',
      });

      const result = await service.update(mockFolderId, mockOrganizationId, { name: 'Renamed' });

      expect(result.path).toBe('/Parent Folder/Renamed');
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      mockPrisma.folder.findFirst.mockResolvedValue({
        ...mockFolder,
        parent: null,
        children: [],
        documents: [],
        createdBy: mockUser,
      });
    });

    it('should delete empty folder', async () => {
      mockPrisma.folder.count.mockResolvedValue(0);
      mockPrisma.document.count.mockResolvedValue(0);
      mockPrisma.folder.delete.mockResolvedValue(mockFolder);

      const result = await service.remove(mockFolderId, mockOrganizationId);

      expect(result).toEqual(mockFolder);
      expect(mockPrisma.folder.delete).toHaveBeenCalledWith({
        where: { id: mockFolderId },
      });
    });

    it('should throw BadRequestException when folder has children', async () => {
      mockPrisma.folder.count.mockResolvedValue(2);
      mockPrisma.document.count.mockResolvedValue(0);

      await expect(
        service.remove(mockFolderId, mockOrganizationId),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.folder.count).toHaveBeenCalledWith({
        where: { parentId: mockFolderId },
      });
    });

    it('should throw BadRequestException when folder has documents', async () => {
      mockPrisma.folder.count.mockResolvedValue(0);
      mockPrisma.document.count.mockResolvedValue(3);

      await expect(
        service.remove(mockFolderId, mockOrganizationId),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.document.count).toHaveBeenCalledWith({
        where: {
          folderId: mockFolderId,
          status: { not: DocumentStatus.DELETED },
        },
      });
    });

    it('should throw NotFoundException when folder not found', async () => {
      mockPrisma.folder.findFirst.mockResolvedValue(null);

      await expect(
        service.remove('non-existent-id', mockOrganizationId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not count deleted documents when checking folder contents', async () => {
      mockPrisma.folder.count.mockResolvedValue(0);
      mockPrisma.document.count.mockResolvedValue(0);
      mockPrisma.folder.delete.mockResolvedValue(mockFolder);

      await service.remove(mockFolderId, mockOrganizationId);

      expect(mockPrisma.document.count).toHaveBeenCalledWith({
        where: {
          folderId: mockFolderId,
          status: { not: DocumentStatus.DELETED },
        },
      });
    });
  });

  describe('getTree', () => {
    it('should build folder tree recursively', async () => {
      const childFolder = {
        id: 'child-folder',
        name: 'Child',
        path: '/Test Folder/Child',
        children: [],
      };

      const folderWithChild = {
        ...mockFolder,
        parent: null,
        children: [childFolder],
        documents: [],
        createdBy: mockUser,
      };

      mockPrisma.folder.findFirst.mockResolvedValue(folderWithChild);
      mockPrisma.folder.findUnique
        .mockResolvedValueOnce({ ...mockFolder, children: [childFolder] })
        .mockResolvedValueOnce({ ...childFolder, children: [] });

      const result = await service.getTree(mockFolderId, mockOrganizationId);

      expect(result).toHaveProperty('id', mockFolderId);
      expect(result).toHaveProperty('name', mockFolder.name);
      expect(result).toHaveProperty('path', mockFolder.path);
      expect(result).toHaveProperty('children');
    });

    it('should throw NotFoundException when folder not found', async () => {
      mockPrisma.folder.findFirst.mockResolvedValue(null);

      await expect(
        service.getTree('non-existent-id', mockOrganizationId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return tree with all nested children', async () => {
      const grandchildFolder = {
        id: 'grandchild',
        name: 'Grandchild',
        path: '/Test Folder/Child/Grandchild',
        children: [],
      };

      const childFolder = {
        id: 'child',
        name: 'Child',
        path: '/Test Folder/Child',
        children: [grandchildFolder],
      };

      mockPrisma.folder.findFirst.mockResolvedValue({
        ...mockFolder,
        parent: null,
        children: [childFolder],
        documents: [],
        createdBy: mockUser,
      });

      mockPrisma.folder.findUnique
        .mockResolvedValueOnce({ ...mockFolder, children: [childFolder] })
        .mockResolvedValueOnce({ ...childFolder, children: [grandchildFolder] })
        .mockResolvedValueOnce({ ...grandchildFolder, children: [] });

      const result = await service.getTree(mockFolderId, mockOrganizationId);

      expect(result.children).toHaveLength(1);
      expect(result.children[0].children).toHaveLength(1);
    });
  });

  describe('getBreadcrumbs', () => {
    it('should return breadcrumbs for nested folder', async () => {
      const nestedFolder = {
        ...mockFolder,
        path: '/Parent/Child/Grandchild',
        parent: null,
        children: [],
        documents: [],
        createdBy: mockUser,
      };

      const parentBreadcrumb = { id: 'parent-id', name: 'Parent', path: '/Parent' };
      const childBreadcrumb = { id: 'child-id', name: 'Child', path: '/Parent/Child' };
      const grandchildBreadcrumb = {
        id: mockFolderId,
        name: 'Grandchild',
        path: '/Parent/Child/Grandchild',
      };

      mockPrisma.folder.findFirst
        .mockResolvedValueOnce(nestedFolder)
        .mockResolvedValueOnce(parentBreadcrumb)
        .mockResolvedValueOnce(childBreadcrumb)
        .mockResolvedValueOnce(grandchildBreadcrumb);

      const result = await service.getBreadcrumbs(mockFolderId, mockOrganizationId);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(parentBreadcrumb);
      expect(result[1]).toEqual(childBreadcrumb);
      expect(result[2]).toEqual(grandchildBreadcrumb);
    });

    it('should return single breadcrumb for root folder', async () => {
      mockPrisma.folder.findFirst
        .mockResolvedValueOnce({
          ...mockFolder,
          parent: null,
          children: [],
          documents: [],
          createdBy: mockUser,
        })
        .mockResolvedValueOnce({ id: mockFolderId, name: mockFolder.name, path: mockFolder.path });

      const result = await service.getBreadcrumbs(mockFolderId, mockOrganizationId);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: mockFolderId,
        name: mockFolder.name,
        path: mockFolder.path,
      });
    });

    it('should throw NotFoundException when folder not found', async () => {
      mockPrisma.folder.findFirst.mockResolvedValue(null);

      await expect(
        service.getBreadcrumbs('non-existent-id', mockOrganizationId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return breadcrumbs in correct order (root to current)', async () => {
      const nestedFolder = {
        ...mockFolder,
        path: '/A/B/C',
        parent: null,
        children: [],
        documents: [],
        createdBy: mockUser,
      };

      mockPrisma.folder.findFirst
        .mockResolvedValueOnce(nestedFolder)
        .mockResolvedValueOnce({ id: 'a', name: 'A', path: '/A' })
        .mockResolvedValueOnce({ id: 'b', name: 'B', path: '/A/B' })
        .mockResolvedValueOnce({ id: 'c', name: 'C', path: '/A/B/C' });

      const result = await service.getBreadcrumbs(mockFolderId, mockOrganizationId);

      expect(result[0].name).toBe('A');
      expect(result[1].name).toBe('B');
      expect(result[2].name).toBe('C');
    });

    it('should handle missing folders in path gracefully', async () => {
      const nestedFolder = {
        ...mockFolder,
        path: '/Parent/Child',
        parent: null,
        children: [],
        documents: [],
        createdBy: mockUser,
      };

      mockPrisma.folder.findFirst
        .mockResolvedValueOnce(nestedFolder)
        .mockResolvedValueOnce(null) // Parent not found
        .mockResolvedValueOnce({ id: 'child', name: 'Child', path: '/Parent/Child' });

      const result = await service.getBreadcrumbs(mockFolderId, mockOrganizationId);

      // Should only include folders that were found
      expect(result.length).toBeLessThanOrEqual(2);
    });
  });
});
