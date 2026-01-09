import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import { PrismaService } from '@/common/prisma/prisma.service';
import { EmbeddingService } from './embedding.service';
import {
  SearchFiltersDto,
  SearchResultItemDto,
  SortField,
  SortOrder,
} from './dto/search.dto';

// =============================================================================
// INTERFACES
// =============================================================================

interface SearchParams {
  organizationId: string;
  query: string;
  type: 'all' | 'documents' | 'folders';
  page: number;
  limit: number;
  sortBy?: SortField;
  sortOrder?: SortOrder;
  filters?: SearchFiltersDto;
}

interface SemanticSearchParams {
  organizationId: string;
  query: string;
  limit: number;
  threshold: number;
  filters?: SearchFiltersDto;
  enableReranking?: boolean;
}

interface HybridSearchParams {
  organizationId: string;
  query: string;
  limit: number;
  textWeight: number;
  semanticWeight: number;
  threshold: number;
  filters?: SearchFiltersDto;
  enableReranking?: boolean;
}

interface VectorSearchResult {
  id: string;
  name: string;
  original_name: string | null;
  mime_type: string;
  size_bytes: bigint;
  status: string;
  processing_status: string;
  extracted_text: string | null;
  folder_id: string | null;
  folder_name: string | null;
  folder_path: string | null;
  created_at: Date;
  updated_at: Date;
  similarity: number;
}

export interface TextSearchResult {
  id: string;
  name: string;
  originalName: string | null;
  mimeType: string;
  sizeBytes: bigint;
  status: string;
  processingStatus: string;
  extractedText: string | null;
  createdAt: Date;
  updatedAt: Date;
  folder: {
    id: string;
    name: string;
    path: string;
  } | null;
  rank?: number;
}

// =============================================================================
// SERVICE
// =============================================================================

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly openaiApiKey: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly configService: ConfigService,
  ) {
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');
  }

  // ===========================================================================
  // FULL-TEXT SEARCH
  // ===========================================================================

  /**
   * Perform full-text search on documents and folders
   */
  async search(params: SearchParams) {
    const { organizationId, query, type, page, limit, sortBy, sortOrder, filters } = params;
    const skip = (page - 1) * limit;
    const startTime = Date.now();

    const results: {
      documents?: TextSearchResult[];
      folders?: unknown[];
    } = {};

    let totalDocuments = 0;
    let totalFolders = 0;

    // Build document where clause
    const documentWhere = this.buildDocumentWhereClause(organizationId, query, filters);

    if (type === 'all' || type === 'documents') {
      // Get total count
      totalDocuments = await this.prisma.document.count({ where: documentWhere });

      // Get documents with ranking
      const documents = await this.prisma.document.findMany({
        where: documentWhere,
        skip,
        take: limit,
        orderBy: this.buildSortOrder(sortBy, sortOrder),
        include: {
          folder: { select: { id: true, name: true, path: true } },
        },
      });

      results.documents = documents.map((doc) => ({
        ...doc,
        rank: 1, // Basic text search doesn't have ranking
      }));
    }

    if (type === 'all' || type === 'folders') {
      const folderWhere: Prisma.FolderWhereInput = {
        organizationId,
        name: { contains: query, mode: 'insensitive' },
      };

      if (filters?.folderId) {
        folderWhere.parentId = filters.folderId;
      }

      totalFolders = await this.prisma.folder.count({ where: folderWhere });

      const folders = await this.prisma.folder.findMany({
        where: folderWhere,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      });

      results.folders = folders;
    }

    const total = type === 'documents' ? totalDocuments : type === 'folders' ? totalFolders : totalDocuments + totalFolders;

    return {
      data: results,
      meta: {
        query,
        algorithm: 'text' as const,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        took: Date.now() - startTime,
      },
    };
  }

  // ===========================================================================
  // SEMANTIC SEARCH
  // ===========================================================================

  /**
   * Perform semantic search using pgvector
   * Searches documents based on semantic similarity to the query
   */
  async semanticSearch(params: SemanticSearchParams) {
    const { organizationId, query, limit, threshold, filters, enableReranking } = params;
    const startTime = Date.now();

    this.logger.log(`Semantic search: "${query}" (threshold: ${threshold}, limit: ${limit})`);

    // Check if embedding service is available
    if (!this.embeddingService.isAvailable()) {
      this.logger.warn('Embedding service not available, falling back to text search');
      return this.fallbackToTextSearch(organizationId, query, limit);
    }

    try {
      // Generate embedding for the search query
      const { embedding: queryEmbedding } = await this.embeddingService.generateEmbedding(query);

      // Perform vector similarity search using raw SQL
      const results = await this.vectorSearch(
        organizationId,
        queryEmbedding,
        limit * 2, // Fetch more for reranking
        threshold,
        filters,
      );

      let processedResults = results.map((r) => this.mapVectorResult(r));

      // Apply reranking if enabled and we have results
      if (enableReranking && processedResults.length > 1) {
        processedResults = await this.rerankResults(query, processedResults);
      }

      // Limit to requested number
      processedResults = processedResults.slice(0, limit);

      return {
        data: processedResults,
        meta: {
          query,
          algorithm: 'semantic' as const,
          total: processedResults.length,
          page: 1,
          limit,
          totalPages: 1,
          took: Date.now() - startTime,
          threshold,
          reranked: enableReranking,
        },
      };
    } catch (error) {
      this.logger.error('Semantic search failed', error);
      return this.fallbackToTextSearch(organizationId, query, limit);
    }
  }

  // ===========================================================================
  // HYBRID SEARCH
  // ===========================================================================

  /**
   * Perform hybrid search combining text and semantic search
   * Uses Reciprocal Rank Fusion (RRF) to combine results
   */
  async hybridSearch(params: HybridSearchParams) {
    const {
      organizationId,
      query,
      limit,
      textWeight,
      semanticWeight,
      threshold,
      filters,
      enableReranking,
    } = params;
    const startTime = Date.now();

    this.logger.log(
      `Hybrid search: "${query}" (text: ${textWeight}, semantic: ${semanticWeight})`,
    );

    // Perform both searches in parallel
    const [textResults, semanticResults] = await Promise.all([
      this.getTextSearchResults(organizationId, query, limit * 2, filters),
      this.embeddingService.isAvailable()
        ? this.getSemanticSearchResults(organizationId, query, limit * 2, threshold, filters)
        : Promise.resolve([]),
    ]);

    // Combine results using Reciprocal Rank Fusion
    const combinedResults = this.reciprocalRankFusion(
      textResults,
      semanticResults,
      textWeight,
      semanticWeight,
    );

    let finalResults = combinedResults;

    // Apply reranking if enabled
    if (enableReranking && finalResults.length > 1) {
      finalResults = await this.rerankResults(query, finalResults);
    }

    // Limit to requested number
    finalResults = finalResults.slice(0, limit);

    return {
      data: finalResults,
      meta: {
        query,
        algorithm: 'hybrid' as const,
        total: finalResults.length,
        page: 1,
        limit,
        totalPages: 1,
        took: Date.now() - startTime,
        threshold,
        reranked: enableReranking,
        textWeight,
        semanticWeight,
      },
    };
  }

  // ===========================================================================
  // AUTOCOMPLETE SUGGESTIONS
  // ===========================================================================

  /**
   * Get autocomplete suggestions for a partial query
   */
  async getSuggestions(organizationId: string, partialQuery: string, limit: number = 5) {
    const query = partialQuery.trim().toLowerCase();

    if (query.length < 2) {
      return { suggestions: [], query: partialQuery };
    }

    // Get matching document names
    const documents = await this.prisma.document.findMany({
      where: {
        organizationId,
        status: { not: 'DELETED' },
        name: { contains: query, mode: 'insensitive' },
      },
      select: { id: true, name: true },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });

    // Get matching folder names
    const folders = await this.prisma.folder.findMany({
      where: {
        organizationId,
        name: { contains: query, mode: 'insensitive' },
      },
      select: { id: true, name: true },
      take: limit,
      orderBy: { name: 'asc' },
    });

    const suggestions = [
      ...documents.map((d) => ({
        text: d.name,
        type: 'document' as const,
        id: d.id,
        score: this.calculateMatchScore(query, d.name),
      })),
      ...folders.map((f) => ({
        text: f.name,
        type: 'folder' as const,
        id: f.id,
        score: this.calculateMatchScore(query, f.name),
      })),
    ]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return { suggestions, query: partialQuery };
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Perform vector similarity search using raw SQL with pgvector
   */
  private async vectorSearch(
    organizationId: string,
    queryEmbedding: number[],
    limit: number,
    threshold: number,
    filters?: SearchFiltersDto,
  ): Promise<VectorSearchResult[]> {
    const vectorString = `[${queryEmbedding.join(',')}]`;

    // Build filter conditions
    const conditions: string[] = [
      `d.organization_id = '${organizationId}'::uuid`,
      `d.status != 'DELETED'`,
      `d.content_vector IS NOT NULL`,
    ];

    if (filters?.folderId) {
      if (filters.includeSubfolders) {
        // Include subfolders using path prefix
        conditions.push(
          `(d.folder_id = '${filters.folderId}'::uuid OR f.path LIKE (SELECT path FROM folders WHERE id = '${filters.folderId}'::uuid) || '%')`,
        );
      } else {
        conditions.push(`d.folder_id = '${filters.folderId}'::uuid`);
      }
    }

    if (filters?.mimeTypes && filters.mimeTypes.length > 0) {
      const mimeList = filters.mimeTypes.map((m) => `'${m}'`).join(',');
      conditions.push(`d.mime_type IN (${mimeList})`);
    }

    if (filters?.statuses && filters.statuses.length > 0) {
      const statusList = filters.statuses.map((s) => `'${s}'`).join(',');
      conditions.push(`d.status IN (${statusList})`);
    }

    if (filters?.createdAt?.from) {
      conditions.push(`d.created_at >= '${filters.createdAt.from}'::timestamptz`);
    }

    if (filters?.createdAt?.to) {
      conditions.push(`d.created_at <= '${filters.createdAt.to}'::timestamptz`);
    }

    if (filters?.sizeRange?.min !== undefined) {
      conditions.push(`d.size_bytes >= ${filters.sizeRange.min}`);
    }

    if (filters?.sizeRange?.max !== undefined) {
      conditions.push(`d.size_bytes <= ${filters.sizeRange.max}`);
    }

    if (filters?.createdById) {
      conditions.push(`d.created_by_id = '${filters.createdById}'::uuid`);
    }

    const whereClause = conditions.join(' AND ');

    // Use cosine similarity (1 - cosine distance)
    // pgvector uses <=> for cosine distance
    const query = `
      SELECT
        d.id,
        d.name,
        d.original_name,
        d.mime_type,
        d.size_bytes,
        d.status,
        d.processing_status,
        d.extracted_text,
        d.folder_id,
        f.name as folder_name,
        f.path as folder_path,
        d.created_at,
        d.updated_at,
        1 - (d.content_vector <=> '${vectorString}'::vector) as similarity
      FROM documents d
      LEFT JOIN folders f ON d.folder_id = f.id
      WHERE ${whereClause}
        AND 1 - (d.content_vector <=> '${vectorString}'::vector) >= ${threshold}
      ORDER BY d.content_vector <=> '${vectorString}'::vector ASC
      LIMIT ${limit}
    `;

    try {
      const results = await this.prisma.$queryRawUnsafe<VectorSearchResult[]>(query);
      return results;
    } catch (error) {
      this.logger.error('Vector search query failed', error);
      throw error;
    }
  }

  /**
   * Map raw vector search result to SearchResultItemDto
   */
  private mapVectorResult(result: VectorSearchResult): SearchResultItemDto {
    return {
      id: result.id,
      name: result.name,
      originalName: result.original_name,
      mimeType: result.mime_type,
      sizeBytes: result.size_bytes,
      status: result.status,
      processingStatus: result.processing_status,
      score: result.similarity,
      semanticScore: result.similarity,
      snippet: this.generateSnippet(result.extracted_text, 200),
      folder: result.folder_id
        ? {
            id: result.folder_id,
            name: result.folder_name || '',
            path: result.folder_path || '',
          }
        : undefined,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  }

  /**
   * Get text search results for hybrid search
   */
  private async getTextSearchResults(
    organizationId: string,
    query: string,
    limit: number,
    filters?: SearchFiltersDto,
  ): Promise<SearchResultItemDto[]> {
    const where = this.buildDocumentWhereClause(organizationId, query, filters);

    const documents = await this.prisma.document.findMany({
      where,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        folder: { select: { id: true, name: true, path: true } },
      },
    });

    return documents.map((doc, index) => ({
      id: doc.id,
      name: doc.name,
      originalName: doc.originalName,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      status: doc.status,
      processingStatus: doc.processingStatus,
      score: 1 / (index + 1), // Simple rank-based score
      textScore: 1 / (index + 1),
      snippet: this.generateSnippet(doc.extractedText, 200),
      folder: doc.folder
        ? {
            id: doc.folder.id,
            name: doc.folder.name,
            path: doc.folder.path,
          }
        : undefined,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));
  }

  /**
   * Get semantic search results for hybrid search
   */
  private async getSemanticSearchResults(
    organizationId: string,
    query: string,
    limit: number,
    threshold: number,
    filters?: SearchFiltersDto,
  ): Promise<SearchResultItemDto[]> {
    try {
      const { embedding } = await this.embeddingService.generateEmbedding(query);
      const results = await this.vectorSearch(organizationId, embedding, limit, threshold, filters);
      return results.map((r) => this.mapVectorResult(r));
    } catch (error) {
      this.logger.error('Semantic search for hybrid failed', error);
      return [];
    }
  }

  /**
   * Combine results using Reciprocal Rank Fusion (RRF)
   * RRF is effective for combining ranked lists from different sources
   */
  private reciprocalRankFusion(
    textResults: SearchResultItemDto[],
    semanticResults: SearchResultItemDto[],
    textWeight: number,
    semanticWeight: number,
    k: number = 60, // RRF constant
  ): SearchResultItemDto[] {
    const scoreMap = new Map<string, { result: SearchResultItemDto; rrfScore: number }>();

    // Add text search results
    textResults.forEach((result, rank) => {
      const rrfScore = textWeight / (k + rank + 1);
      scoreMap.set(result.id, {
        result: { ...result, textScore: result.score },
        rrfScore,
      });
    });

    // Add semantic search results
    semanticResults.forEach((result, rank) => {
      const rrfScore = semanticWeight / (k + rank + 1);
      const existing = scoreMap.get(result.id);

      if (existing) {
        // Combine scores for documents found by both methods
        existing.rrfScore += rrfScore;
        existing.result.semanticScore = result.semanticScore;
      } else {
        scoreMap.set(result.id, {
          result: { ...result, semanticScore: result.semanticScore },
          rrfScore,
        });
      }
    });

    // Sort by combined RRF score
    return Array.from(scoreMap.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .map(({ result, rrfScore }) => ({
        ...result,
        score: rrfScore,
      }));
  }

  /**
   * Rerank results using GPT-4 for improved relevance ordering
   * This is a simplified implementation - production would use a cross-encoder model
   */
  private async rerankResults(
    query: string,
    results: SearchResultItemDto[],
  ): Promise<SearchResultItemDto[]> {
    if (!this.openaiApiKey || results.length < 2) {
      return results;
    }

    try {
      // For efficiency, only rerank top candidates
      const candidatesToRerank = results.slice(0, 20);

      // Build context for reranking
      const documentsContext = candidatesToRerank
        .map(
          (r, i) =>
            `[${i}] "${r.name}": ${r.snippet || 'No content preview'}`,
        )
        .join('\n');

      const prompt = `Given the search query: "${query}"

Rank these documents by relevance (most to least relevant). Return only the indices in order.

Documents:
${documentsContext}

Response format: comma-separated indices (e.g., "3,1,0,2,4")`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0,
          max_tokens: 100,
        }),
      });

      if (!response.ok) {
        throw new Error('Reranking API call failed');
      }

      const data = await response.json() as { choices: Array<{ message: { content: string } }> };
      const content = data.choices[0].message.content.trim();

      // Parse the response and reorder
      const indices = content
        .split(',')
        .map((s: string) => parseInt(s.trim(), 10))
        .filter((n: number) => !isNaN(n) && n >= 0 && n < candidatesToRerank.length);

      if (indices.length === 0) {
        return results;
      }

      // Build reranked list
      const reranked: SearchResultItemDto[] = [];
      const used = new Set<number>();

      for (const idx of indices) {
        if (!used.has(idx)) {
          const item = candidatesToRerank[idx];
          reranked.push({
            ...item,
            rerankScore: 1 - reranked.length / indices.length,
          });
          used.add(idx);
        }
      }

      // Add any remaining candidates that weren't ranked
      candidatesToRerank.forEach((item, idx) => {
        if (!used.has(idx)) {
          reranked.push(item);
        }
      });

      // Add any results beyond the reranking window
      reranked.push(...results.slice(20));

      return reranked;
    } catch (error) {
      this.logger.warn('Reranking failed, returning original order', error);
      return results;
    }
  }

  /**
   * Build Prisma where clause for document search
   */
  private buildDocumentWhereClause(
    organizationId: string,
    query: string,
    filters?: SearchFiltersDto,
  ): Prisma.DocumentWhereInput {
    const where: Prisma.DocumentWhereInput = {
      organizationId,
      status: { not: 'DELETED' },
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { extractedText: { contains: query, mode: 'insensitive' } },
        {
          metadata: {
            path: ['title'],
            string_contains: query,
          },
        },
      ],
    };

    if (filters) {
      if (filters.folderId) {
        where.folderId = filters.folderId;
      }

      if (filters.mimeTypes && filters.mimeTypes.length > 0) {
        where.mimeType = { in: filters.mimeTypes };
      }

      if (filters.statuses && filters.statuses.length > 0) {
        where.status = { in: filters.statuses as any };
      }

      if (filters.createdAt) {
        where.createdAt = {};
        if (filters.createdAt.from) {
          where.createdAt.gte = new Date(filters.createdAt.from);
        }
        if (filters.createdAt.to) {
          where.createdAt.lte = new Date(filters.createdAt.to);
        }
      }

      if (filters.sizeRange) {
        where.sizeBytes = {};
        if (filters.sizeRange.min !== undefined) {
          where.sizeBytes.gte = filters.sizeRange.min;
        }
        if (filters.sizeRange.max !== undefined) {
          where.sizeBytes.lte = filters.sizeRange.max;
        }
      }

      if (filters.createdById) {
        where.createdById = filters.createdById;
      }
    }

    return where;
  }

  /**
   * Build sort order for Prisma query
   */
  private buildSortOrder(
    sortBy?: SortField,
    sortOrder?: SortOrder,
  ): Prisma.DocumentOrderByWithRelationInput {
    const order = sortOrder === SortOrder.ASC ? 'asc' : 'desc';

    switch (sortBy) {
      case SortField.NAME:
        return { name: order };
      case SortField.CREATED_AT:
        return { createdAt: order };
      case SortField.UPDATED_AT:
        return { updatedAt: order };
      case SortField.SIZE:
        return { sizeBytes: order };
      case SortField.RELEVANCE:
      default:
        return { updatedAt: 'desc' };
    }
  }

  /**
   * Fallback to text search when semantic search is unavailable
   */
  private async fallbackToTextSearch(organizationId: string, query: string, limit: number) {
    const documents = await this.prisma.document.findMany({
      where: {
        organizationId,
        status: { not: 'DELETED' },
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { extractedText: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        folder: { select: { id: true, name: true, path: true } },
      },
    });

    return {
      data: documents.map((doc) => ({
        id: doc.id,
        name: doc.name,
        originalName: doc.originalName,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        status: doc.status,
        processingStatus: doc.processingStatus,
        score: 0.5,
        snippet: this.generateSnippet(doc.extractedText, 200),
        folder: doc.folder
          ? {
              id: doc.folder.id,
              name: doc.folder.name,
              path: doc.folder.path,
            }
          : undefined,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      })),
      meta: {
        query,
        algorithm: 'text-fallback' as const,
        total: documents.length,
        page: 1,
        limit,
        totalPages: 1,
        took: 0,
      },
    };
  }

  /**
   * Generate a text snippet from extracted content
   */
  private generateSnippet(text: string | null, maxLength: number): string | undefined {
    if (!text) return undefined;

    const trimmed = text.trim();
    if (trimmed.length <= maxLength) {
      return trimmed;
    }

    // Try to break at a word boundary
    const truncated = trimmed.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.7) {
      return truncated.slice(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

  /**
   * Calculate match score for autocomplete suggestions
   */
  private calculateMatchScore(query: string, text: string): number {
    const lowerQuery = query.toLowerCase();
    const lowerText = text.toLowerCase();

    // Exact match at start
    if (lowerText.startsWith(lowerQuery)) {
      return 1.0;
    }

    // Word boundary match
    if (lowerText.includes(' ' + lowerQuery)) {
      return 0.8;
    }

    // Contains match
    if (lowerText.includes(lowerQuery)) {
      return 0.6;
    }

    return 0.4;
  }
}
