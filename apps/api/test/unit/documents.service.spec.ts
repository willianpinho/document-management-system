/**
 * Documents Service Unit Tests
 *
 * Tests the DocumentsService business logic in isolation
 * using direct instantiation pattern for better mocking control.
 */

import { describe, it, expect, beforeEach, vi, type MockedObject } from 'vitest';
import { DocumentsService } from '../../src/modules/documents/documents.service';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { StorageService } from '../../src/modules/storage/storage.service';
import { ProcessingService } from '../../src/modules/processing/processing.service';
import { RealtimeService } from '../../src/modules/realtime/realtime.service';
import { AuditService } from '../../src/modules/audit/audit.service';

describe('DocumentsService (Unit)', () => {
  let service: DocumentsService;
  let prismaService: MockedObject<PrismaService>;
  let storageService: MockedObject<StorageService>;
  let processingService: MockedObject<ProcessingService>;
  let realtimeService: MockedObject<RealtimeService>;
  let auditService: MockedObject<AuditService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    organizationId: 'org-123',
    role: 'admin' as const,
  };

  const mockDocument = {
    id: 'doc-123',
    name: 'test-document.pdf',
    originalName: 'test-document.pdf',
    mimeType: 'application/pdf',
    sizeBytes: BigInt(1024000),
    s3Key: 'org-123/documents/doc-123/test-document.pdf',
    status: 'READY',
    processingStatus: 'COMPLETED',
    organizationId: 'org-123',
    folderId: null,
    createdById: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    checksum: 'abc123',
    metadata: {},
    extractedText: null,
    thumbnailKey: null,
    s3VersionId: null,
    contentVector: null,
  };

  beforeEach(() => {
    // Create mocks
    prismaService = {
      document: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      documentVersion: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      $transaction: jest.fn((cb) => cb(prismaService)),
    } as unknown as jest.Mocked<PrismaService>;

    storageService = {
      getPresignedUploadUrl: vi.fn(),
      getPresignedDownloadUrl: vi.fn(),
      deleteObject: vi.fn(),
      headObject: vi.fn(),
    } as unknown as jest.Mocked<StorageService>;

    processingService = {
      addJob: vi.fn(),
    } as unknown as jest.Mocked<ProcessingService>;

    realtimeService = {
      emitToOrganization: vi.fn(),
    } as unknown as jest.Mocked<RealtimeService>;

    auditService = {
      log: vi.fn(),
    } as unknown as jest.Mocked<AuditService>;

    // Create service with mocks
    service = new DocumentsService(
      prismaService,
      storageService,
      processingService,
      realtimeService,
      auditService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated documents', async () => {
      const mockDocuments = [mockDocument];
      prismaService.document.findMany.mockResolvedValue(mockDocuments);
      prismaService.document.count.mockResolvedValue(1);

      const result = await service.findAll(mockUser, {
        page: 1,
        limit: 10,
      });

      expect(result.data).toEqual(mockDocuments);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
    });

    it('should filter by folder', async () => {
      const folderId = 'folder-123';
      prismaService.document.findMany.mockResolvedValue([]);
      prismaService.document.count.mockResolvedValue(0);

      await service.findAll(mockUser, {
        page: 1,
        limit: 10,
        folderId,
      });

      expect(prismaService.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            folderId,
          }),
        }),
      );
    });

    it('should filter by MIME type', async () => {
      prismaService.document.findMany.mockResolvedValue([]);
      prismaService.document.count.mockResolvedValue(0);

      await service.findAll(mockUser, {
        page: 1,
        limit: 10,
        mimeType: 'application/pdf',
      });

      expect(prismaService.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            mimeType: 'application/pdf',
          }),
        }),
      );
    });

    it('should search by name', async () => {
      prismaService.document.findMany.mockResolvedValue([]);
      prismaService.document.count.mockResolvedValue(0);

      await service.findAll(mockUser, {
        page: 1,
        limit: 10,
        search: 'test',
      });

      expect(prismaService.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: expect.objectContaining({
              contains: 'test',
            }),
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a document by ID', async () => {
      prismaService.document.findFirst.mockResolvedValue(mockDocument);

      const result = await service.findOne(mockUser, 'doc-123');

      expect(result).toEqual(mockDocument);
      expect(prismaService.document.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'doc-123',
          organizationId: mockUser.organizationId,
          deletedAt: null,
        },
        include: expect.any(Object),
      });
    });

    it('should throw if document not found', async () => {
      prismaService.document.findFirst.mockResolvedValue(null);

      await expect(service.findOne(mockUser, 'not-found')).rejects.toThrow();
    });
  });

  describe('create', () => {
    const createDto = {
      name: 'new-document.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024000,
      checksum: 'abc123',
      folderId: undefined,
    };

    it('should create a document and return presigned URL', async () => {
      const newDoc = { ...mockDocument, id: 'new-doc-123' };
      prismaService.document.create.mockResolvedValue(newDoc);
      storageService.getPresignedUploadUrl.mockResolvedValue({
        url: 'https://s3.example.com/upload',
        fields: { key: 'value' },
      });

      const result = await service.create(mockUser, createDto);

      expect(result.document).toEqual(newDoc);
      expect(result.uploadUrl).toBe('https://s3.example.com/upload');
      expect(prismaService.document.create).toHaveBeenCalled();
    });

    it('should enforce organization isolation', async () => {
      const newDoc = { ...mockDocument, id: 'new-doc-123' };
      prismaService.document.create.mockResolvedValue(newDoc);
      storageService.getPresignedUploadUrl.mockResolvedValue({
        url: 'https://s3.example.com/upload',
        fields: {},
      });

      await service.create(mockUser, createDto);

      expect(prismaService.document.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: mockUser.organizationId,
          createdById: mockUser.id,
        }),
      });
    });
  });

  describe('update', () => {
    it('should update document name', async () => {
      prismaService.document.findFirst.mockResolvedValue(mockDocument);
      prismaService.document.update.mockResolvedValue({
        ...mockDocument,
        name: 'updated-name.pdf',
      });

      const result = await service.update(mockUser, 'doc-123', {
        name: 'updated-name.pdf',
      });

      expect(result.name).toBe('updated-name.pdf');
    });

    it('should move document to folder', async () => {
      prismaService.document.findFirst.mockResolvedValue(mockDocument);
      prismaService.document.update.mockResolvedValue({
        ...mockDocument,
        folderId: 'folder-123',
      });

      const result = await service.update(mockUser, 'doc-123', {
        folderId: 'folder-123',
      });

      expect(result.folderId).toBe('folder-123');
    });
  });

  describe('delete', () => {
    it('should soft delete document', async () => {
      prismaService.document.findFirst.mockResolvedValue(mockDocument);
      prismaService.document.update.mockResolvedValue({
        ...mockDocument,
        deletedAt: new Date(),
      });

      await service.delete(mockUser, 'doc-123');

      expect(prismaService.document.update).toHaveBeenCalledWith({
        where: { id: 'doc-123' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should hard delete and remove from S3', async () => {
      prismaService.document.findFirst.mockResolvedValue(mockDocument);
      prismaService.document.delete.mockResolvedValue(mockDocument);
      storageService.deleteObject.mockResolvedValue(undefined);

      await service.delete(mockUser, 'doc-123', true);

      expect(prismaService.document.delete).toHaveBeenCalled();
      expect(storageService.deleteObject).toHaveBeenCalledWith(mockDocument.s3Key);
    });
  });

  describe('getDownloadUrl', () => {
    it('should return presigned download URL', async () => {
      prismaService.document.findFirst.mockResolvedValue(mockDocument);
      storageService.getPresignedDownloadUrl.mockResolvedValue(
        'https://s3.example.com/download',
      );

      const result = await service.getDownloadUrl(mockUser, 'doc-123');

      expect(result).toBe('https://s3.example.com/download');
      expect(storageService.getPresignedDownloadUrl).toHaveBeenCalledWith(
        mockDocument.s3Key,
        3600,
      );
    });
  });

  describe('triggerProcessing', () => {
    it('should add OCR job to queue', async () => {
      prismaService.document.findFirst.mockResolvedValue(mockDocument);
      prismaService.document.update.mockResolvedValue({
        ...mockDocument,
        processingStatus: 'PROCESSING',
      });
      processingService.addJob.mockResolvedValue({ id: 'job-123' });

      await service.triggerProcessing(mockUser, 'doc-123', 'ocr');

      expect(processingService.addJob).toHaveBeenCalledWith(
        'ocr',
        expect.objectContaining({
          documentId: 'doc-123',
        }),
      );
    });

    it('should add thumbnail job to queue', async () => {
      prismaService.document.findFirst.mockResolvedValue(mockDocument);
      prismaService.document.update.mockResolvedValue(mockDocument);
      processingService.addJob.mockResolvedValue({ id: 'job-123' });

      await service.triggerProcessing(mockUser, 'doc-123', 'thumbnail');

      expect(processingService.addJob).toHaveBeenCalledWith(
        'thumbnail',
        expect.objectContaining({
          documentId: 'doc-123',
        }),
      );
    });
  });
});
