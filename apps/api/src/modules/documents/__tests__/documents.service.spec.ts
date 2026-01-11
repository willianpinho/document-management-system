/**
 * DocumentsService Unit Tests
 *
 * Tests for document management operations including CRUD, pagination,
 * soft delete/restore, and presigned URL generation.
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { DocumentStatus, ProcessingStatus } from '@prisma/client';

import { DocumentsService } from '../documents.service';

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

// Types for mocks
type MockPrismaDocument = {
  create: Mock;
  findMany: Mock;
  findFirst: Mock;
  findUnique: Mock;
  update: Mock;
  count: Mock;
};

type MockPrismaProcessingJob = {
  create: Mock;
};

interface MockPrisma {
  document: MockPrismaDocument;
  processingJob: MockPrismaProcessingJob;
}

interface MockStorage {
  getPresignedUploadUrl: Mock;
  getPresignedDownloadUrl: Mock;
  getObject: Mock;
}

interface MockRealtime {
  emitDocumentCreated: Mock;
  emitDocumentUpdated: Mock;
  emitDocumentDeleted: Mock;
}

// Test fixtures
const mockOrganizationId = '550e8400-e29b-41d4-a716-446655440000';
const mockUserId = '660e8400-e29b-41d4-a716-446655440001';
const mockDocumentId = '770e8400-e29b-41d4-a716-446655440002';
const mockFolderId = '880e8400-e29b-41d4-a716-446655440003';

const mockUser = {
  id: mockUserId,
  name: 'Test User',
  email: 'test@example.com',
};

const mockDocument = {
  id: mockDocumentId,
  name: 'test-document.pdf',
  mimeType: 'application/pdf',
  sizeBytes: BigInt(1024),
  s3Key: `${mockOrganizationId}/uuid/test-document.pdf`,
  status: DocumentStatus.UPLOADED,
  processingStatus: ProcessingStatus.PENDING,
  organizationId: mockOrganizationId,
  folderId: null,
  thumbnailKey: null,
  checksum: null,
  metadata: null,
  extractedText: null,
  deletedAt: null,
  createdById: mockUserId,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  createdBy: mockUser,
};

const mockFolder = {
  id: mockFolderId,
  name: 'Test Folder',
  path: '/Test Folder',
};

describe('DocumentsService', () => {
  let service: DocumentsService;
  let mockPrisma: MockPrisma;
  let mockStorage: MockStorage;
  let mockRealtime: MockRealtime;

  beforeEach(() => {
    // Create fresh mocks for each test
    mockPrisma = {
      document: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      processingJob: {
        create: vi.fn(),
      },
    };

    mockStorage = {
      getPresignedUploadUrl: vi.fn(),
      getPresignedDownloadUrl: vi.fn(),
      getObject: vi.fn(),
    };

    mockRealtime = {
      emitDocumentCreated: vi.fn(),
      emitDocumentUpdated: vi.fn(),
      emitDocumentDeleted: vi.fn(),
    };

    // Create service instance with mocks
    service = new DocumentsService(
      mockPrisma as any,
      mockStorage as any,
      mockRealtime as any,
    );
  });

  describe('create', () => {
    const createInput = {
      name: 'new-document.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      organizationId: mockOrganizationId,
      createdById: mockUserId,
    };

    it('should create a document and return presigned upload URL', async () => {
      const expectedUploadUrl = 'https://s3.amazonaws.com/bucket/key?signature=xxx';

      mockPrisma.document.create.mockResolvedValue({
        ...mockDocument,
        name: createInput.name,
        status: DocumentStatus.PROCESSING,
        processingStatus: ProcessingStatus.PENDING,
      });
      mockStorage.getPresignedUploadUrl.mockResolvedValue(expectedUploadUrl);

      const result = await service.create(createInput);

      expect(result).toHaveProperty('document');
      expect(result).toHaveProperty('uploadUrl');
      expect(result.uploadUrl).toBe(expectedUploadUrl);
      expect(result.document.name).toBe(createInput.name);
      expect(result.document.status).toBe(DocumentStatus.PROCESSING);

      expect(mockPrisma.document.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: createInput.name,
          mimeType: createInput.mimeType,
          sizeBytes: createInput.sizeBytes,
          status: DocumentStatus.PROCESSING,
          processingStatus: ProcessingStatus.PENDING,
          organizationId: createInput.organizationId,
          createdById: createInput.createdById,
        }),
        include: expect.any(Object),
      });

      expect(mockStorage.getPresignedUploadUrl).toHaveBeenCalledWith(
        expect.stringContaining(mockOrganizationId),
        createInput.mimeType,
      );
    });

    it('should create document with folder assignment', async () => {
      const inputWithFolder = {
        ...createInput,
        folderId: mockFolderId,
      };

      mockPrisma.document.create.mockResolvedValue({
        ...mockDocument,
        folderId: mockFolderId,
      });
      mockStorage.getPresignedUploadUrl.mockResolvedValue('https://s3.url');

      const result = await service.create(inputWithFolder);

      expect(mockPrisma.document.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          folderId: mockFolderId,
        }),
        include: expect.any(Object),
      });
      expect(result.document.folderId).toBe(mockFolderId);
    });

    it('should generate S3 key with organization ID', async () => {
      mockPrisma.document.create.mockResolvedValue(mockDocument);
      mockStorage.getPresignedUploadUrl.mockResolvedValue('https://s3.url');

      await service.create(createInput);

      const createCall = mockPrisma.document.create.mock.calls[0][0];
      expect(createCall.data.s3Key).toContain(mockOrganizationId);
      expect(createCall.data.s3Key).toContain(createInput.name);
    });
  });

  describe('findAll', () => {
    const findAllParams = {
      organizationId: mockOrganizationId,
      page: 1,
      limit: 10,
    };

    it('should return paginated documents', async () => {
      const documents = [mockDocument, { ...mockDocument, id: 'doc-2' }];

      mockPrisma.document.findMany.mockResolvedValue(documents);
      mockPrisma.document.count.mockResolvedValue(2);

      const result = await service.findAll(findAllParams);

      expect(result.data).toHaveLength(2);
      expect(result.meta.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      });
    });

    it('should filter by folderId when provided', async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.document.count.mockResolvedValue(0);

      await service.findAll({ ...findAllParams, folderId: mockFolderId });

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            folderId: mockFolderId,
          }),
        }),
      );
    });

    it('should filter by search term when provided', async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.document.count.mockResolvedValue(0);

      await service.findAll({ ...findAllParams, search: 'report' });

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: 'report', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('should exclude deleted documents', async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.document.count.mockResolvedValue(0);

      await service.findAll(findAllParams);

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { not: 'DELETED' },
          }),
        }),
      );
    });

    it('should calculate correct pagination for second page', async () => {
      const documents = [mockDocument];
      mockPrisma.document.findMany.mockResolvedValue(documents);
      mockPrisma.document.count.mockResolvedValue(15);

      const result = await service.findAll({ ...findAllParams, page: 2, limit: 10 });

      expect(result.meta.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 15,
        totalPages: 2,
        hasNext: false,
        hasPrevious: true,
      });

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });

    it('should sort by createdAt descending by default', async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.document.count.mockResolvedValue(0);

      await service.findAll(findAllParams);

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should include createdBy relation', async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.document.count.mockResolvedValue(0);

      await service.findAll(findAllParams);

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            createdBy: {
              select: { id: true, name: true, email: true },
            },
          },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return document when found', async () => {
      const documentWithRelations = {
        ...mockDocument,
        folder: mockFolder,
        versions: [],
      };

      mockPrisma.document.findFirst.mockResolvedValue(documentWithRelations);

      const result = await service.findOne(mockDocumentId, mockOrganizationId);

      // The service converts BigInt sizeBytes to Number via toApiResponse()
      expect(result.id).toBe(documentWithRelations.id);
      expect(result.name).toBe(documentWithRelations.name);
      expect(result.sizeBytes).toBe(Number(documentWithRelations.sizeBytes));
      expect(mockPrisma.document.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockDocumentId,
          organizationId: mockOrganizationId,
          status: { not: DocumentStatus.DELETED },
        },
        select: expect.objectContaining({
          id: true,
          name: true,
          createdBy: expect.any(Object),
          folder: true,
          versions: expect.any(Object),
        }),
      });
    });

    it('should throw NotFoundException when document not found', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('non-existent-id', mockOrganizationId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not return deleted documents', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(mockDocumentId, mockOrganizationId),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.document.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { not: DocumentStatus.DELETED },
          }),
        }),
      );
    });

    it('should enforce organization isolation', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      const differentOrgId = 'different-org-id';
      await expect(
        service.findOne(mockDocumentId, differentOrgId),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.document.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: differentOrgId,
          }),
        }),
      );
    });
  });

  describe('update', () => {
    const updateInput = {
      name: 'updated-document.pdf',
      folderId: mockFolderId,
      metadata: { category: 'reports' },
    };

    beforeEach(() => {
      mockPrisma.document.findFirst.mockResolvedValue(mockDocument);
    });

    it('should update document metadata', async () => {
      const updatedDocument = { ...mockDocument, ...updateInput };
      mockPrisma.document.update.mockResolvedValue(updatedDocument);

      const result = await service.update(mockDocumentId, mockOrganizationId, updateInput);

      expect(result.name).toBe(updateInput.name);
      expect(mockPrisma.document.update).toHaveBeenCalledWith({
        where: { id: mockDocumentId },
        data: expect.objectContaining({
          name: updateInput.name,
          folderId: updateInput.folderId,
          metadata: updateInput.metadata,
        }),
        include: expect.any(Object),
      });
    });

    it('should update only provided fields', async () => {
      const partialUpdate = { name: 'partial-update.pdf' };
      mockPrisma.document.update.mockResolvedValue({
        ...mockDocument,
        ...partialUpdate,
      });

      await service.update(mockDocumentId, mockOrganizationId, partialUpdate);

      expect(mockPrisma.document.update).toHaveBeenCalledWith({
        where: { id: mockDocumentId },
        data: { name: partialUpdate.name },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException when document not found', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', mockOrganizationId, updateInput),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow setting folderId to null (move to root)', async () => {
      mockPrisma.document.update.mockResolvedValue({
        ...mockDocument,
        folderId: null,
      });

      await service.update(mockDocumentId, mockOrganizationId, { folderId: null });

      expect(mockPrisma.document.update).toHaveBeenCalledWith({
        where: { id: mockDocumentId },
        data: { folderId: null },
        include: expect.any(Object),
      });
    });
  });

  describe('remove (soft delete)', () => {
    beforeEach(() => {
      mockPrisma.document.findFirst.mockResolvedValue(mockDocument);
    });

    it('should soft delete document by updating status', async () => {
      const deletedDocument = { ...mockDocument, status: DocumentStatus.DELETED };
      mockPrisma.document.update.mockResolvedValue(deletedDocument);

      const result = await service.remove(mockDocumentId, mockOrganizationId);

      expect(result.status).toBe(DocumentStatus.DELETED);
      expect(mockPrisma.document.update).toHaveBeenCalledWith({
        where: { id: mockDocumentId },
        data: { status: DocumentStatus.DELETED },
      });
    });

    it('should throw NotFoundException when document not found', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await expect(
        service.remove('non-existent-id', mockOrganizationId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDownloadUrl', () => {
    const expectedDownloadUrl = 'https://s3.amazonaws.com/bucket/key?signature=download';

    beforeEach(() => {
      mockPrisma.document.findFirst.mockResolvedValue(mockDocument);
      mockStorage.getPresignedDownloadUrl.mockResolvedValue(expectedDownloadUrl);
    });

    it('should return presigned download URL', async () => {
      const result = await service.getDownloadUrl(mockDocumentId, mockOrganizationId);

      expect(result).toEqual({
        url: expectedDownloadUrl,
        expiresIn: 3600,
      });
    });

    it('should generate URL for correct S3 key', async () => {
      await service.getDownloadUrl(mockDocumentId, mockOrganizationId);

      expect(mockStorage.getPresignedDownloadUrl).toHaveBeenCalledWith(
        mockDocument.s3Key,
      );
    });

    it('should throw NotFoundException when document not found', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await expect(
        service.getDownloadUrl('non-existent-id', mockOrganizationId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('triggerProcessing', () => {
    const processDto = {
      type: 'ocr',
      options: { language: 'en' },
    };

    beforeEach(() => {
      mockPrisma.document.findFirst.mockResolvedValue(mockDocument);
    });

    it('should create processing job', async () => {
      const mockJob = {
        id: 'job-123',
        documentId: mockDocumentId,
        jobType: processDto.type,
        status: 'PENDING',
      };

      mockPrisma.processingJob.create.mockResolvedValue(mockJob);
      mockPrisma.document.update.mockResolvedValue(mockDocument);

      const result = await service.triggerProcessing(
        mockDocumentId,
        mockOrganizationId,
        processDto,
      );

      expect(result).toHaveProperty('job');
      expect(result).toHaveProperty('message', 'Processing job created');
      expect(result.job.id).toBe('job-123');
    });

    it('should update document processing status', async () => {
      const mockJob = { id: 'job-123' };
      mockPrisma.processingJob.create.mockResolvedValue(mockJob);
      mockPrisma.document.update.mockResolvedValue(mockDocument);

      await service.triggerProcessing(mockDocumentId, mockOrganizationId, processDto);

      expect(mockPrisma.document.update).toHaveBeenCalledWith({
        where: { id: mockDocumentId },
        data: { processingStatus: ProcessingStatus.OCR_IN_PROGRESS },
      });
    });

    it('should throw NotFoundException when document not found', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await expect(
        service.triggerProcessing('non-existent-id', mockOrganizationId, processDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should pass processing options to job', async () => {
      const mockJob = { id: 'job-123' };
      mockPrisma.processingJob.create.mockResolvedValue(mockJob);
      mockPrisma.document.update.mockResolvedValue(mockDocument);

      await service.triggerProcessing(mockDocumentId, mockOrganizationId, processDto);

      expect(mockPrisma.processingJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          inputParams: processDto.options,
        }),
      });
    });
  });

  describe('confirmUpload', () => {
    beforeEach(() => {
      mockPrisma.document.findFirst.mockResolvedValue({
        ...mockDocument,
        status: DocumentStatus.PROCESSING,
      });
    });

    it('should update document status to uploaded', async () => {
      const confirmedDocument = { ...mockDocument, status: DocumentStatus.UPLOADED };
      mockPrisma.document.update.mockResolvedValue(confirmedDocument);

      const result = await service.confirmUpload(mockDocumentId, mockOrganizationId);

      expect(result.status).toBe(DocumentStatus.UPLOADED);
      expect(mockPrisma.document.update).toHaveBeenCalledWith({
        where: { id: mockDocumentId },
        data: { status: DocumentStatus.UPLOADED },
      });
    });

    it('should throw NotFoundException when document not found', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await expect(
        service.confirmUpload('non-existent-id', mockOrganizationId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDocumentBuffer', () => {
    beforeEach(() => {
      mockPrisma.document.findFirst.mockResolvedValue(mockDocument);
    });

    it('should return document buffer from S3', async () => {
      const mockBuffer = Buffer.from('mock file content');
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield mockBuffer;
        },
      };

      mockStorage.getObject.mockResolvedValue(mockStream);

      const result = await service.getDocumentBuffer(mockDocumentId, mockOrganizationId);

      expect(result).toEqual(mockBuffer);
      expect(mockStorage.getObject).toHaveBeenCalledWith(mockDocument.s3Key);
    });

    it('should concatenate multiple chunks', async () => {
      const chunk1 = Buffer.from('chunk1');
      const chunk2 = Buffer.from('chunk2');
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield chunk1;
          yield chunk2;
        },
      };

      mockStorage.getObject.mockResolvedValue(mockStream);

      const result = await service.getDocumentBuffer(mockDocumentId, mockOrganizationId);

      expect(result).toEqual(Buffer.concat([chunk1, chunk2]));
    });

    it('should throw NotFoundException when document not found', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await expect(
        service.getDocumentBuffer('non-existent-id', mockOrganizationId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDocumentBuffers', () => {
    it('should return multiple document buffers', async () => {
      const doc1 = { ...mockDocument, id: 'doc-1', s3Key: 'key1' };
      const doc2 = { ...mockDocument, id: 'doc-2', s3Key: 'key2' };

      const buffer1 = Buffer.from('content1');
      const buffer2 = Buffer.from('content2');

      mockPrisma.document.findFirst
        .mockResolvedValueOnce(doc1)
        .mockResolvedValueOnce(doc2);

      const createMockStream = (buffer: Buffer) => ({
        async *[Symbol.asyncIterator]() {
          yield buffer;
        },
      });

      mockStorage.getObject
        .mockResolvedValueOnce(createMockStream(buffer1))
        .mockResolvedValueOnce(createMockStream(buffer2));

      const result = await service.getDocumentBuffers(
        ['doc-1', 'doc-2'],
        mockOrganizationId,
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(buffer1);
      expect(result[1]).toEqual(buffer2);
    });

    it('should return empty array for empty input', async () => {
      const result = await service.getDocumentBuffers([], mockOrganizationId);
      expect(result).toEqual([]);
    });
  });
});
