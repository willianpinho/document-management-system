/**
 * SearchService Unit Tests
 *
 * Tests for search operations including full-text search, semantic search,
 * hybrid search, and autocomplete suggestions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { SearchService } from '../search.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EmbeddingService } from '../embedding.service';

// Mock factory for PrismaService
const createMockPrismaService = () => ({
  document: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  folder: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  $queryRawUnsafe: vi.fn(),
});

// Mock factory for EmbeddingService
const createMockEmbeddingService = () => ({
  isAvailable: vi.fn(),
  generateEmbedding: vi.fn(),
  getDimensions: vi.fn(),
});

// Mock factory for ConfigService
const createMockConfigService = () => ({
  get: vi.fn((key: string, defaultValue?: string) => {
    const config: Record<string, string> = {
      OPENAI_API_KEY: 'test-api-key',
    };
    return config[key] || defaultValue;
  }),
});

// Test fixtures
const mockOrganizationId = '550e8400-e29b-41d4-a716-446655440000';
const mockDocumentId = '660e8400-e29b-41d4-a716-446655440001';
const mockFolderId = '770e8400-e29b-41d4-a716-446655440002';

const mockDocument = {
  id: mockDocumentId,
  organizationId: mockOrganizationId,
  name: 'Quarterly Report Q4 2024.pdf',
  originalName: 'quarterly-report.pdf',
  mimeType: 'application/pdf',
  sizeBytes: BigInt(2048),
  status: 'READY',
  processingStatus: 'COMPLETE',
  extractedText: 'Financial results for Q4 2024 showing revenue growth...',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  folder: {
    id: mockFolderId,
    name: 'Reports',
    path: '/Reports',
  },
};

const mockFolder = {
  id: mockFolderId,
  organizationId: mockOrganizationId,
  name: 'Reports',
  path: '/Reports',
};

describe('SearchService', () => {
  let service: SearchService;
  let prismaService: ReturnType<typeof createMockPrismaService>;
  let embeddingService: ReturnType<typeof createMockEmbeddingService>;
  let configService: ReturnType<typeof createMockConfigService>;

  beforeEach(async () => {
    prismaService = createMockPrismaService();
    embeddingService = createMockEmbeddingService();
    configService = createMockConfigService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: PrismaService, useValue: prismaService },
        { provide: EmbeddingService, useValue: embeddingService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('search (full-text)', () => {
    const searchParams = {
      organizationId: mockOrganizationId,
      query: 'quarterly report',
      type: 'all' as const,
      page: 1,
      limit: 10,
    };

    it('should return documents matching search query', async () => {
      prismaService.document.count.mockResolvedValue(1);
      prismaService.document.findMany.mockResolvedValue([mockDocument]);
      prismaService.folder.count.mockResolvedValue(0);
      prismaService.folder.findMany.mockResolvedValue([]);

      const result = await service.search(searchParams);

      expect(result.data.documents).toHaveLength(1);
      expect(result.data.documents![0].name).toContain('Quarterly Report');
      expect(result.meta.algorithm).toBe('text');
    });

    it('should search in document name with case-insensitive match', async () => {
      prismaService.document.count.mockResolvedValue(0);
      prismaService.document.findMany.mockResolvedValue([]);
      prismaService.folder.count.mockResolvedValue(0);
      prismaService.folder.findMany.mockResolvedValue([]);

      await service.search(searchParams);

      expect(prismaService.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                name: { contains: 'quarterly report', mode: 'insensitive' },
              }),
            ]),
          }),
        }),
      );
    });

    it('should exclude deleted documents', async () => {
      prismaService.document.count.mockResolvedValue(0);
      prismaService.document.findMany.mockResolvedValue([]);
      prismaService.folder.count.mockResolvedValue(0);
      prismaService.folder.findMany.mockResolvedValue([]);

      await service.search(searchParams);

      expect(prismaService.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { not: 'DELETED' },
          }),
        }),
      );
    });

    it('should return paginated results with correct metadata', async () => {
      prismaService.document.count.mockResolvedValue(25);
      prismaService.document.findMany.mockResolvedValue([mockDocument]);
      prismaService.folder.count.mockResolvedValue(0);
      prismaService.folder.findMany.mockResolvedValue([]);

      const result = await service.search({ ...searchParams, page: 2 });

      expect(result.meta.total).toBe(25);
      expect(result.meta.page).toBe(2);
      expect(result.meta.totalPages).toBe(3);
    });

    it('should search only documents when type is documents', async () => {
      prismaService.document.count.mockResolvedValue(1);
      prismaService.document.findMany.mockResolvedValue([mockDocument]);

      const result = await service.search({ ...searchParams, type: 'documents' });

      expect(result.data.documents).toBeDefined();
      expect(result.data.folders).toBeUndefined();
      expect(prismaService.folder.findMany).not.toHaveBeenCalled();
    });

    it('should search only folders when type is folders', async () => {
      prismaService.folder.count.mockResolvedValue(1);
      prismaService.folder.findMany.mockResolvedValue([mockFolder]);

      const result = await service.search({ ...searchParams, type: 'folders' });

      expect(result.data.folders).toBeDefined();
      expect(result.data.documents).toBeUndefined();
      expect(prismaService.document.findMany).not.toHaveBeenCalled();
    });

    it('should apply folder filter when provided', async () => {
      prismaService.document.count.mockResolvedValue(0);
      prismaService.document.findMany.mockResolvedValue([]);
      prismaService.folder.count.mockResolvedValue(0);
      prismaService.folder.findMany.mockResolvedValue([]);

      await service.search({
        ...searchParams,
        filters: { folderId: mockFolderId },
      });

      expect(prismaService.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            folderId: mockFolderId,
          }),
        }),
      );
    });

    it('should apply MIME type filter when provided', async () => {
      prismaService.document.count.mockResolvedValue(0);
      prismaService.document.findMany.mockResolvedValue([]);
      prismaService.folder.count.mockResolvedValue(0);
      prismaService.folder.findMany.mockResolvedValue([]);

      await service.search({
        ...searchParams,
        filters: { mimeTypes: ['application/pdf', 'image/png'] },
      });

      expect(prismaService.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            mimeType: { in: ['application/pdf', 'image/png'] },
          }),
        }),
      );
    });

    it('should apply date range filter when provided', async () => {
      prismaService.document.count.mockResolvedValue(0);
      prismaService.document.findMany.mockResolvedValue([]);
      prismaService.folder.count.mockResolvedValue(0);
      prismaService.folder.findMany.mockResolvedValue([]);

      const filters = {
        createdAt: {
          from: '2025-01-01T00:00:00Z',
          to: '2025-01-31T23:59:59Z',
        },
      };

      await service.search({ ...searchParams, filters });

      expect(prismaService.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('should include execution time in response', async () => {
      prismaService.document.count.mockResolvedValue(0);
      prismaService.document.findMany.mockResolvedValue([]);
      prismaService.folder.count.mockResolvedValue(0);
      prismaService.folder.findMany.mockResolvedValue([]);

      const result = await service.search(searchParams);

      expect(result.meta).toHaveProperty('took');
      expect(typeof result.meta.took).toBe('number');
    });
  });

  describe('semanticSearch', () => {
    const semanticParams = {
      organizationId: mockOrganizationId,
      query: 'financial performance metrics',
      limit: 10,
      threshold: 0.7,
    };

    beforeEach(() => {
      embeddingService.isAvailable.mockReturnValue(true);
      embeddingService.generateEmbedding.mockResolvedValue({
        embedding: new Array(1536).fill(0.1),
        tokens: 10,
      });
    });

    it('should perform semantic search when embedding service is available', async () => {
      prismaService.$queryRawUnsafe.mockResolvedValue([
        {
          id: mockDocumentId,
          name: mockDocument.name,
          original_name: mockDocument.originalName,
          mime_type: mockDocument.mimeType,
          size_bytes: mockDocument.sizeBytes,
          status: mockDocument.status,
          processing_status: mockDocument.processingStatus,
          extracted_text: mockDocument.extractedText,
          folder_id: mockFolderId,
          folder_name: 'Reports',
          folder_path: '/Reports',
          created_at: mockDocument.createdAt,
          updated_at: mockDocument.updatedAt,
          similarity: 0.85,
        },
      ]);

      const result = await service.semanticSearch(semanticParams);

      expect(result.meta.algorithm).toBe('semantic');
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty('semanticScore', 0.85);
    });

    it('should generate embedding for search query', async () => {
      prismaService.$queryRawUnsafe.mockResolvedValue([]);

      await service.semanticSearch(semanticParams);

      expect(embeddingService.generateEmbedding).toHaveBeenCalledWith(
        semanticParams.query,
      );
    });

    it('should fallback to text search when embedding service is unavailable', async () => {
      embeddingService.isAvailable.mockReturnValue(false);
      prismaService.document.findMany.mockResolvedValue([]);

      const result = await service.semanticSearch(semanticParams);

      expect(result.meta.algorithm).toBe('text-fallback');
    });

    it('should apply similarity threshold', async () => {
      prismaService.$queryRawUnsafe.mockResolvedValue([]);

      await service.semanticSearch({ ...semanticParams, threshold: 0.8 });

      // Verify the raw query includes threshold in WHERE clause
      expect(prismaService.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('>= 0.8'),
      );
    });

    it('should include semantic score in results', async () => {
      prismaService.$queryRawUnsafe.mockResolvedValue([
        {
          id: mockDocumentId,
          name: mockDocument.name,
          original_name: null,
          mime_type: mockDocument.mimeType,
          size_bytes: mockDocument.sizeBytes,
          status: mockDocument.status,
          processing_status: mockDocument.processingStatus,
          extracted_text: null,
          folder_id: null,
          folder_name: null,
          folder_path: null,
          created_at: new Date(),
          updated_at: new Date(),
          similarity: 0.92,
        },
      ]);

      const result = await service.semanticSearch(semanticParams);

      expect(result.data[0].semanticScore).toBe(0.92);
    });

    it('should fallback to text search on embedding error', async () => {
      embeddingService.generateEmbedding.mockRejectedValue(
        new Error('OpenAI API error'),
      );
      prismaService.document.findMany.mockResolvedValue([]);

      const result = await service.semanticSearch(semanticParams);

      expect(result.meta.algorithm).toBe('text-fallback');
    });

    it('should limit results to requested count', async () => {
      const manyResults = Array(20)
        .fill(null)
        .map((_, i) => ({
          id: `doc-${i}`,
          name: `Document ${i}`,
          original_name: null,
          mime_type: 'application/pdf',
          size_bytes: BigInt(1024),
          status: 'READY',
          processing_status: 'COMPLETE',
          extracted_text: null,
          folder_id: null,
          folder_name: null,
          folder_path: null,
          created_at: new Date(),
          updated_at: new Date(),
          similarity: 0.8 - i * 0.01,
        }));

      prismaService.$queryRawUnsafe.mockResolvedValue(manyResults);

      const result = await service.semanticSearch({ ...semanticParams, limit: 5 });

      expect(result.data.length).toBeLessThanOrEqual(5);
    });
  });

  describe('hybridSearch', () => {
    const hybridParams = {
      organizationId: mockOrganizationId,
      query: 'revenue growth',
      limit: 10,
      textWeight: 0.3,
      semanticWeight: 0.7,
      threshold: 0.7,
    };

    beforeEach(() => {
      embeddingService.isAvailable.mockReturnValue(true);
      embeddingService.generateEmbedding.mockResolvedValue({
        embedding: new Array(1536).fill(0.1),
        tokens: 10,
      });
    });

    it('should combine text and semantic search results', async () => {
      prismaService.document.findMany.mockResolvedValue([mockDocument]);
      prismaService.$queryRawUnsafe.mockResolvedValue([
        {
          id: mockDocumentId,
          name: mockDocument.name,
          original_name: null,
          mime_type: mockDocument.mimeType,
          size_bytes: mockDocument.sizeBytes,
          status: mockDocument.status,
          processing_status: mockDocument.processingStatus,
          extracted_text: null,
          folder_id: null,
          folder_name: null,
          folder_path: null,
          created_at: new Date(),
          updated_at: new Date(),
          similarity: 0.85,
        },
      ]);

      const result = await service.hybridSearch(hybridParams);

      expect(result.meta.algorithm).toBe('hybrid');
      expect(result.data).toHaveLength(1);
    });

    it('should use Reciprocal Rank Fusion for combining results', async () => {
      const textDoc = { ...mockDocument, id: 'doc-text' };
      const semanticDoc = {
        id: 'doc-semantic',
        name: 'Semantic Result',
        original_name: null,
        mime_type: 'application/pdf',
        size_bytes: BigInt(1024),
        status: 'READY',
        processing_status: 'COMPLETE',
        extracted_text: null,
        folder_id: null,
        folder_name: null,
        folder_path: null,
        created_at: new Date(),
        updated_at: new Date(),
        similarity: 0.9,
      };

      prismaService.document.findMany.mockResolvedValue([textDoc]);
      prismaService.$queryRawUnsafe.mockResolvedValue([semanticDoc]);

      const result = await service.hybridSearch(hybridParams);

      // Both documents should be in results
      expect(result.data.length).toBe(2);
      // Results should have combined scores
      expect(result.data.every((d) => d.score !== undefined)).toBe(true);
    });

    it('should apply weights correctly', async () => {
      prismaService.document.findMany.mockResolvedValue([mockDocument]);
      prismaService.$queryRawUnsafe.mockResolvedValue([]);

      const result = await service.hybridSearch(hybridParams);

      expect(result.meta).toHaveProperty('textWeight', 0.3);
      expect(result.meta).toHaveProperty('semanticWeight', 0.7);
    });

    it('should fallback to text-only when semantic unavailable', async () => {
      embeddingService.isAvailable.mockReturnValue(false);
      prismaService.document.findMany.mockResolvedValue([mockDocument]);

      const result = await service.hybridSearch(hybridParams);

      expect(result.data).toHaveLength(1);
      // Should still work but without semantic results
    });

    it('should merge duplicate documents from both searches', async () => {
      // Same document found by both text and semantic search
      prismaService.document.findMany.mockResolvedValue([mockDocument]);
      prismaService.$queryRawUnsafe.mockResolvedValue([
        {
          id: mockDocumentId, // Same ID
          name: mockDocument.name,
          original_name: null,
          mime_type: mockDocument.mimeType,
          size_bytes: mockDocument.sizeBytes,
          status: mockDocument.status,
          processing_status: mockDocument.processingStatus,
          extracted_text: null,
          folder_id: null,
          folder_name: null,
          folder_path: null,
          created_at: new Date(),
          updated_at: new Date(),
          similarity: 0.85,
        },
      ]);

      const result = await service.hybridSearch(hybridParams);

      // Should have only one result (merged)
      expect(result.data).toHaveLength(1);
      // Merged document should have higher combined score
      expect(result.data[0].score).toBeGreaterThan(0);
    });
  });

  describe('getSuggestions', () => {
    it('should return autocomplete suggestions', async () => {
      prismaService.document.findMany.mockResolvedValue([
        { id: 'doc-1', name: 'Report 2024' },
        { id: 'doc-2', name: 'Report 2023' },
      ]);
      prismaService.folder.findMany.mockResolvedValue([
        { id: 'folder-1', name: 'Reports' },
      ]);

      const result = await service.getSuggestions(mockOrganizationId, 'rep', 5);

      expect(result.suggestions).toHaveLength(3);
      expect(result.query).toBe('rep');
    });

    it('should return empty for queries shorter than 2 characters', async () => {
      const result = await service.getSuggestions(mockOrganizationId, 'r', 5);

      expect(result.suggestions).toEqual([]);
      expect(prismaService.document.findMany).not.toHaveBeenCalled();
    });

    it('should sort suggestions by match score', async () => {
      prismaService.document.findMany.mockResolvedValue([
        { id: 'doc-1', name: 'My Report' },
        { id: 'doc-2', name: 'Report' },
      ]);
      prismaService.folder.findMany.mockResolvedValue([]);

      const result = await service.getSuggestions(mockOrganizationId, 'report', 5);

      // Exact prefix match should come first
      expect(result.suggestions[0].text).toBe('Report');
    });

    it('should include both documents and folders', async () => {
      prismaService.document.findMany.mockResolvedValue([
        { id: 'doc-1', name: 'Finance Report' },
      ]);
      prismaService.folder.findMany.mockResolvedValue([
        { id: 'folder-1', name: 'Finance' },
      ]);

      const result = await service.getSuggestions(mockOrganizationId, 'finance', 5);

      const types = result.suggestions.map((s) => s.type);
      expect(types).toContain('document');
      expect(types).toContain('folder');
    });

    it('should limit results to requested count', async () => {
      prismaService.document.findMany.mockResolvedValue([
        { id: 'doc-1', name: 'Test 1' },
        { id: 'doc-2', name: 'Test 2' },
        { id: 'doc-3', name: 'Test 3' },
      ]);
      prismaService.folder.findMany.mockResolvedValue([
        { id: 'folder-1', name: 'Test Folder' },
      ]);

      const result = await service.getSuggestions(mockOrganizationId, 'test', 2);

      expect(result.suggestions).toHaveLength(2);
    });

    it('should exclude deleted documents from suggestions', async () => {
      prismaService.document.findMany.mockResolvedValue([]);
      prismaService.folder.findMany.mockResolvedValue([]);

      await service.getSuggestions(mockOrganizationId, 'test', 5);

      expect(prismaService.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { not: 'DELETED' },
          }),
        }),
      );
    });
  });

  describe('filter building', () => {
    const baseParams = {
      organizationId: mockOrganizationId,
      query: 'test',
      type: 'documents' as const,
      page: 1,
      limit: 10,
    };

    beforeEach(() => {
      prismaService.document.count.mockResolvedValue(0);
      prismaService.document.findMany.mockResolvedValue([]);
    });

    it('should apply size range filter', async () => {
      await service.search({
        ...baseParams,
        filters: { sizeRange: { min: 1000, max: 5000 } },
      });

      expect(prismaService.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sizeBytes: { gte: 1000, lte: 5000 },
          }),
        }),
      );
    });

    it('should apply createdBy filter', async () => {
      const userId = 'user-123';
      await service.search({
        ...baseParams,
        filters: { createdById: userId },
      });

      expect(prismaService.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdById: userId,
          }),
        }),
      );
    });

    it('should apply multiple statuses filter', async () => {
      await service.search({
        ...baseParams,
        filters: { statuses: ['READY', 'PROCESSING'] },
      });

      expect(prismaService.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['READY', 'PROCESSING'] },
          }),
        }),
      );
    });
  });

  describe('snippet generation', () => {
    it('should generate snippet from extracted text', async () => {
      const longText = 'A'.repeat(500);
      prismaService.$queryRawUnsafe.mockResolvedValue([
        {
          id: mockDocumentId,
          name: 'Test',
          original_name: null,
          mime_type: 'application/pdf',
          size_bytes: BigInt(1024),
          status: 'READY',
          processing_status: 'COMPLETE',
          extracted_text: longText,
          folder_id: null,
          folder_name: null,
          folder_path: null,
          created_at: new Date(),
          updated_at: new Date(),
          similarity: 0.8,
        },
      ]);

      embeddingService.isAvailable.mockReturnValue(true);
      embeddingService.generateEmbedding.mockResolvedValue({
        embedding: new Array(1536).fill(0.1),
        tokens: 10,
      });

      const result = await service.semanticSearch({
        organizationId: mockOrganizationId,
        query: 'test',
        limit: 10,
        threshold: 0.7,
      });

      // Snippet should be truncated
      expect(result.data[0].snippet).toBeDefined();
      expect(result.data[0].snippet!.length).toBeLessThanOrEqual(203); // 200 + "..."
    });
  });
});
