import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '@/common/prisma/prisma.service';
import {
  DocumentEmbedding,
  EmbeddingOptions,
} from '../dto/ocr-result.dto';

/**
 * Default embedding options
 */
const DEFAULT_EMBEDDING_OPTIONS: Required<EmbeddingOptions> = {
  model: 'text-embedding-ada-002',
  maxTokensPerChunk: 8191, // ada-002 limit
  aggregateChunks: true,
  dimensions: 1536, // ada-002 dimensions
};

/**
 * Token estimation constants
 * Rough estimate: 1 token ~= 4 characters for English text
 */
const CHARS_PER_TOKEN = 4;

/**
 * OpenAI Embedding Service
 *
 * Generates embeddings for document text using OpenAI's embedding models.
 * Handles text chunking for long documents and stores vectors in PostgreSQL
 * using pgvector extension.
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.baseUrl = this.configService.get<string>(
      'OPENAI_API_BASE_URL',
      'https://api.openai.com/v1',
    );

    if (!this.apiKey) {
      this.logger.warn('OpenAI API key not configured. Embedding generation will be skipped.');
    }
  }

  /**
   * Check if embedding service is available
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Generate embedding for text and optionally store in database
   */
  async generateAndStoreEmbedding(
    documentId: string,
    text: string,
    options?: EmbeddingOptions,
  ): Promise<DocumentEmbedding | null> {
    if (!this.isAvailable()) {
      this.logger.warn('Embedding service not available. Skipping embedding generation.');
      return null;
    }

    const opts = { ...DEFAULT_EMBEDDING_OPTIONS, ...options };

    this.logger.log(`Generating embedding for document ${documentId}`);

    // Estimate tokens and check if chunking is needed
    const estimatedTokens = this.estimateTokens(text);
    const wasTruncated = estimatedTokens > opts.maxTokensPerChunk;

    let textToEmbed = text;
    let chunkInfo: DocumentEmbedding['chunkInfo'];

    if (wasTruncated) {
      if (opts.aggregateChunks) {
        // Generate embeddings for multiple chunks and average them
        return this.generateAggregatedEmbedding(documentId, text, opts);
      } else {
        // Truncate to first chunk
        textToEmbed = this.truncateToTokenLimit(text, opts.maxTokensPerChunk);
        chunkInfo = {
          chunkIndex: 0,
          totalChunks: Math.ceil(estimatedTokens / opts.maxTokensPerChunk),
          startChar: 0,
          endChar: textToEmbed.length,
        };
      }
    }

    // Generate embedding
    const vector = await this.callEmbeddingApi(textToEmbed, opts.model, opts.dimensions);

    // Store in database
    await this.storeEmbedding(documentId, vector);

    const embedding: DocumentEmbedding = {
      documentId,
      model: opts.model,
      dimensions: vector.length,
      vector,
      sourceText: textToEmbed,
      tokenCount: this.estimateTokens(textToEmbed),
      wasTruncated,
      chunkInfo,
      createdAt: new Date(),
    };

    this.logger.log(
      `Generated ${vector.length}-dimensional embedding for document ${documentId}`,
    );

    return embedding;
  }

  /**
   * Generate embedding for text without storing
   */
  async generateEmbedding(
    text: string,
    options?: EmbeddingOptions,
  ): Promise<number[]> {
    if (!this.isAvailable()) {
      throw new Error('Embedding service not available. Configure OPENAI_API_KEY.');
    }

    const opts = { ...DEFAULT_EMBEDDING_OPTIONS, ...options };

    // Truncate if necessary
    const truncatedText = this.truncateToTokenLimit(text, opts.maxTokensPerChunk);

    return this.callEmbeddingApi(truncatedText, opts.model, opts.dimensions);
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateBatchEmbeddings(
    texts: string[],
    options?: EmbeddingOptions,
  ): Promise<number[][]> {
    if (!this.isAvailable()) {
      throw new Error('Embedding service not available. Configure OPENAI_API_KEY.');
    }

    const opts = { ...DEFAULT_EMBEDDING_OPTIONS, ...options };

    // Truncate texts if necessary
    const truncatedTexts = texts.map((text) =>
      this.truncateToTokenLimit(text, opts.maxTokensPerChunk),
    );

    return this.callBatchEmbeddingApi(truncatedTexts, opts.model, opts.dimensions);
  }

  /**
   * Store embedding vector in document
   */
  async storeEmbedding(documentId: string, vector: number[]): Promise<void> {
    if (vector.length !== 1536) {
      this.logger.warn(
        `Embedding dimension mismatch: expected 1536, got ${vector.length}. Skipping storage.`,
      );
      return;
    }

    const vectorString = `[${vector.join(',')}]`;

    await this.prisma.$executeRaw`
      UPDATE documents
      SET content_vector = ${vectorString}::vector
      WHERE id = ${documentId}::uuid
    `;

    this.logger.log(`Stored embedding for document ${documentId}`);
  }

  /**
   * Find similar documents using vector similarity search
   */
  async findSimilarDocuments(
    queryVector: number[],
    organizationId: string,
    limit: number = 10,
    minSimilarity: number = 0.7,
  ): Promise<Array<{ documentId: string; similarity: number }>> {
    const vectorString = `[${queryVector.join(',')}]`;

    const results = await this.prisma.$queryRaw<
      Array<{ id: string; similarity: number }>
    >`
      SELECT
        id,
        1 - (content_vector <=> ${vectorString}::vector) as similarity
      FROM documents
      WHERE organization_id = ${organizationId}::uuid
        AND content_vector IS NOT NULL
        AND 1 - (content_vector <=> ${vectorString}::vector) >= ${minSimilarity}
      ORDER BY content_vector <=> ${vectorString}::vector
      LIMIT ${limit}
    `;

    return results.map((r) => ({
      documentId: r.id,
      similarity: r.similarity,
    }));
  }

  /**
   * Search documents by text query
   */
  async semanticSearch(
    query: string,
    organizationId: string,
    limit: number = 10,
    minSimilarity: number = 0.7,
    options?: EmbeddingOptions,
  ): Promise<Array<{ documentId: string; similarity: number }>> {
    const queryVector = await this.generateEmbedding(query, options);
    return this.findSimilarDocuments(queryVector, organizationId, limit, minSimilarity);
  }

  /**
   * Generate aggregated embedding for long documents
   * Splits into chunks, embeds each, then averages
   */
  private async generateAggregatedEmbedding(
    documentId: string,
    text: string,
    opts: Required<EmbeddingOptions>,
  ): Promise<DocumentEmbedding> {
    const chunks = this.splitIntoChunks(text, opts.maxTokensPerChunk);

    this.logger.log(
      `Generating ${chunks.length} chunk embeddings for document ${documentId}`,
    );

    // Generate embeddings for all chunks
    const chunkEmbeddings = await this.callBatchEmbeddingApi(
      chunks,
      opts.model,
      opts.dimensions,
    );

    // Average the embeddings
    const aggregatedVector = this.averageVectors(chunkEmbeddings);

    // Store in database
    await this.storeEmbedding(documentId, aggregatedVector);

    return {
      documentId,
      model: opts.model,
      dimensions: aggregatedVector.length,
      vector: aggregatedVector,
      sourceText: text.substring(0, 1000) + (text.length > 1000 ? '...' : ''),
      tokenCount: this.estimateTokens(text),
      wasTruncated: true,
      chunkInfo: {
        chunkIndex: -1, // Indicates aggregated
        totalChunks: chunks.length,
        startChar: 0,
        endChar: text.length,
      },
      createdAt: new Date(),
    };
  }

  /**
   * Call OpenAI embedding API for single text
   */
  private async callEmbeddingApi(
    text: string,
    model: string,
    dimensions?: number,
  ): Promise<number[]> {
    const body: Record<string, unknown> = {
      model,
      input: text,
    };

    // Only add dimensions for text-embedding-3-* models
    if (model.includes('text-embedding-3') && dimensions) {
      body.dimensions = dimensions;
    }

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI embedding API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as { data: Array<{ embedding: number[] }> };
    return data.data[0].embedding;
  }

  /**
   * Call OpenAI embedding API for batch of texts
   */
  private async callBatchEmbeddingApi(
    texts: string[],
    model: string,
    dimensions?: number,
  ): Promise<number[][]> {
    // OpenAI batch limit is 2048 texts
    const batchSize = 2048;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      const body: Record<string, unknown> = {
        model,
        input: batch,
      };

      if (model.includes('text-embedding-3') && dimensions) {
        body.dimensions = dimensions;
      }

      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI embedding API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as { data: Array<{ index: number; embedding: number[] }> };

      // Sort by index to maintain order
      const sortedData = data.data.sort(
        (a: { index: number }, b: { index: number }) => a.index - b.index,
      );

      allEmbeddings.push(...sortedData.map((d: { embedding: number[] }) => d.embedding));
    }

    return allEmbeddings;
  }

  /**
   * Split text into chunks that fit within token limit
   */
  private splitIntoChunks(text: string, maxTokens: number): string[] {
    const maxChars = maxTokens * CHARS_PER_TOKEN;
    const chunks: string[] = [];

    // Try to split at sentence boundaries
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > maxChars) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        // If single sentence is too long, split it
        if (sentence.length > maxChars) {
          const words = sentence.split(/\s+/);
          currentChunk = '';
          for (const word of words) {
            if ((currentChunk + ' ' + word).length > maxChars) {
              if (currentChunk) {
                chunks.push(currentChunk.trim());
              }
              currentChunk = word;
            } else {
              currentChunk += ' ' + word;
            }
          }
        } else {
          currentChunk = sentence;
        }
      } else {
        currentChunk += sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Average multiple vectors into one
   */
  private averageVectors(vectors: number[][]): number[] {
    if (vectors.length === 0) return [];
    if (vectors.length === 1) return vectors[0];

    const dimensions = vectors[0].length;
    const averaged = new Array(dimensions).fill(0);

    for (const vector of vectors) {
      for (let i = 0; i < dimensions; i++) {
        averaged[i] += vector[i];
      }
    }

    for (let i = 0; i < dimensions; i++) {
      averaged[i] /= vectors.length;
    }

    // Normalize the averaged vector
    const magnitude = Math.sqrt(
      averaged.reduce((sum, val) => sum + val * val, 0),
    );

    if (magnitude > 0) {
      for (let i = 0; i < dimensions; i++) {
        averaged[i] /= magnitude;
      }
    }

    return averaged;
  }

  /**
   * Estimate token count for text
   */
  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ~= 4 characters
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  /**
   * Truncate text to fit within token limit
   */
  private truncateToTokenLimit(text: string, maxTokens: number): string {
    const maxChars = maxTokens * CHARS_PER_TOKEN;
    if (text.length <= maxChars) return text;

    // Try to truncate at word boundary
    const truncated = text.substring(0, maxChars);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxChars * 0.8) {
      return truncated.substring(0, lastSpace);
    }

    return truncated;
  }

  /**
   * Delete embedding for a document
   */
  async deleteEmbedding(documentId: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE documents
      SET content_vector = NULL
      WHERE id = ${documentId}::uuid
    `;

    this.logger.log(`Deleted embedding for document ${documentId}`);
  }

  /**
   * Check if a document has an embedding
   */
  async hasEmbedding(documentId: string): Promise<boolean> {
    const result = await this.prisma.$queryRaw<Array<{ has_embedding: boolean }>>`
      SELECT content_vector IS NOT NULL as has_embedding
      FROM documents
      WHERE id = ${documentId}::uuid
    `;

    return result[0]?.has_embedding || false;
  }

  /**
   * Get embedding statistics for organization
   */
  async getEmbeddingStats(organizationId: string): Promise<{
    totalDocuments: number;
    documentsWithEmbeddings: number;
    coveragePercent: number;
  }> {
    const result = await this.prisma.$queryRaw<
      Array<{
        total: bigint;
        with_embeddings: bigint;
      }>
    >`
      SELECT
        COUNT(*) as total,
        COUNT(content_vector) as with_embeddings
      FROM documents
      WHERE organization_id = ${organizationId}::uuid
        AND deleted_at IS NULL
    `;

    const total = Number(result[0]?.total || 0);
    const withEmbeddings = Number(result[0]?.with_embeddings || 0);

    return {
      totalDocuments: total,
      documentsWithEmbeddings: withEmbeddings,
      coveragePercent: total > 0 ? (withEmbeddings / total) * 100 : 0,
    };
  }
}
