import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * OpenAI API response types
 */
interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

interface EmbeddingResult {
  embedding: number[];
  tokens: number;
}

interface BatchEmbeddingResult {
  embeddings: number[][];
  totalTokens: number;
}

interface ChunkInfo {
  text: string;
  startIndex: number;
  endIndex: number;
  tokens: number;
}

/**
 * EmbeddingService handles all embedding-related operations using OpenAI's API.
 *
 * Supports:
 * - Single text embedding generation
 * - Batch embedding generation (up to 2048 inputs per batch)
 * - Text chunking for long documents
 * - Chunk embedding combination strategies
 * - Token estimation
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly openaiApiKey: string | undefined;
  private readonly embeddingModel: string;
  private readonly embeddingDimensions: number;
  private readonly maxTokensPerRequest: number;
  private readonly maxBatchSize: number;

  constructor(private readonly configService: ConfigService) {
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');
    // Use text-embedding-3-small for better performance/cost ratio
    this.embeddingModel = this.configService.get<string>(
      'OPENAI_EMBEDDING_MODEL',
      'text-embedding-3-small',
    );
    // text-embedding-3-small outputs 1536 dimensions by default
    this.embeddingDimensions = this.configService.get<number>(
      'OPENAI_EMBEDDING_DIMENSIONS',
      1536,
    );
    // Maximum tokens per embedding request
    this.maxTokensPerRequest = 8191;
    // Maximum batch size for OpenAI embeddings API
    this.maxBatchSize = 2048;
  }

  /**
   * Check if embedding service is configured and available
   */
  isAvailable(): boolean {
    return !!this.openaiApiKey;
  }

  /**
   * Get the embedding dimensions used by the current model
   */
  getDimensions(): number {
    return this.embeddingDimensions;
  }

  /**
   * Generate embedding for a single text input
   * @param text - The text to embed
   * @returns Embedding result with vector and token count
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const trimmedText = text.trim();
    if (!trimmedText) {
      throw new Error('Cannot generate embedding for empty text');
    }

    // Estimate tokens and truncate if necessary
    const estimatedTokens = this.countTokens(trimmedText);
    const processedText =
      estimatedTokens > this.maxTokensPerRequest
        ? this.truncateToTokenLimit(trimmedText, this.maxTokensPerRequest)
        : trimmedText;

    try {
      const response = await this.callEmbeddingAPI([processedText]);
      return {
        embedding: response.data[0].embedding,
        tokens: response.usage.prompt_tokens,
      };
    } catch (error) {
      this.logger.error('Failed to generate embedding', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * More efficient than calling generateEmbedding multiple times
   * @param texts - Array of texts to embed
   * @returns Batch result with all embeddings and total token count
   */
  async batchGenerateEmbeddings(texts: string[]): Promise<BatchEmbeddingResult> {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    if (texts.length === 0) {
      return { embeddings: [], totalTokens: 0 };
    }

    // Process and validate texts
    const processedTexts = texts.map((text) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return '[empty]'; // Placeholder for empty texts
      }
      const tokens = this.countTokens(trimmed);
      return tokens > this.maxTokensPerRequest
        ? this.truncateToTokenLimit(trimmed, this.maxTokensPerRequest)
        : trimmed;
    });

    // Split into batches if necessary
    const batches: string[][] = [];
    for (let i = 0; i < processedTexts.length; i += this.maxBatchSize) {
      batches.push(processedTexts.slice(i, i + this.maxBatchSize));
    }

    const allEmbeddings: number[][] = [];
    let totalTokens = 0;

    // Process each batch
    for (const batch of batches) {
      try {
        const response = await this.callEmbeddingAPI(batch);

        // Sort by index to maintain order
        const sorted = response.data.sort((a, b) => a.index - b.index);
        allEmbeddings.push(...sorted.map((d) => d.embedding));
        totalTokens += response.usage.total_tokens;
      } catch (error) {
        this.logger.error(`Batch embedding failed for ${batch.length} texts`, error);
        throw error;
      }
    }

    return { embeddings: allEmbeddings, totalTokens };
  }

  /**
   * Split long text into chunks suitable for embedding
   * Uses semantic-aware chunking with overlap for better context
   * @param text - The text to chunk
   * @param maxTokens - Maximum tokens per chunk (default: 500)
   * @param overlap - Token overlap between chunks (default: 50)
   * @returns Array of chunk information
   */
  chunkText(text: string, maxTokens: number = 500, overlap: number = 50): ChunkInfo[] {
    if (!text || !text.trim()) {
      return [];
    }

    const trimmedText = text.trim();
    const totalTokens = this.countTokens(trimmedText);

    // If text fits in single chunk, return as-is
    if (totalTokens <= maxTokens) {
      return [
        {
          text: trimmedText,
          startIndex: 0,
          endIndex: trimmedText.length,
          tokens: totalTokens,
        },
      ];
    }

    const chunks: ChunkInfo[] = [];
    const sentences = this.splitIntoSentences(trimmedText);

    let currentChunk = '';
    let currentTokens = 0;
    let chunkStartIndex = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const sentenceTokens = this.countTokens(sentence);

      // If single sentence exceeds max tokens, split it further
      if (sentenceTokens > maxTokens) {
        // Save current chunk if not empty
        if (currentChunk) {
          chunks.push({
            text: currentChunk.trim(),
            startIndex: chunkStartIndex,
            endIndex: chunkStartIndex + currentChunk.length,
            tokens: currentTokens,
          });
        }

        // Split long sentence by words
        const wordChunks = this.splitLongSentence(sentence, maxTokens);
        for (const wordChunk of wordChunks) {
          chunks.push(wordChunk);
        }

        currentChunk = '';
        currentTokens = 0;
        chunkStartIndex = trimmedText.indexOf(sentence) + sentence.length;
        continue;
      }

      // Check if adding this sentence exceeds limit
      if (currentTokens + sentenceTokens > maxTokens) {
        // Save current chunk
        if (currentChunk) {
          chunks.push({
            text: currentChunk.trim(),
            startIndex: chunkStartIndex,
            endIndex: chunkStartIndex + currentChunk.length,
            tokens: currentTokens,
          });
        }

        // Start new chunk with overlap from previous sentences
        const overlapText = this.getOverlapText(sentences, i, overlap);
        currentChunk = overlapText + sentence;
        currentTokens = this.countTokens(currentChunk);
        chunkStartIndex = trimmedText.indexOf(sentence);
      } else {
        currentChunk += sentence;
        currentTokens += sentenceTokens;
      }
    }

    // Add final chunk
    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        startIndex: chunkStartIndex,
        endIndex: chunkStartIndex + currentChunk.length,
        tokens: currentTokens,
      });
    }

    return chunks;
  }

  /**
   * Combine multiple chunk embeddings into a single document embedding
   * Uses weighted average based on chunk length
   * @param embeddings - Array of chunk embeddings
   * @param weights - Optional weights for each chunk (default: equal weights)
   * @returns Combined embedding vector
   */
  combineChunkEmbeddings(embeddings: number[][], weights?: number[]): number[] {
    if (embeddings.length === 0) {
      throw new Error('Cannot combine empty embeddings array');
    }

    if (embeddings.length === 1) {
      return embeddings[0];
    }

    const dimensions = embeddings[0].length;

    // Use provided weights or equal weights
    const effectiveWeights = weights || embeddings.map(() => 1 / embeddings.length);

    // Normalize weights
    const weightSum = effectiveWeights.reduce((sum, w) => sum + w, 0);
    const normalizedWeights = effectiveWeights.map((w) => w / weightSum);

    // Compute weighted average
    const combined = new Array(dimensions).fill(0);

    for (let i = 0; i < embeddings.length; i++) {
      const embedding = embeddings[i];
      const weight = normalizedWeights[i];

      for (let j = 0; j < dimensions; j++) {
        combined[j] += embedding[j] * weight;
      }
    }

    // Normalize the combined vector (L2 normalization)
    const magnitude = Math.sqrt(combined.reduce((sum, val) => sum + val * val, 0));
    return combined.map((val) => val / magnitude);
  }

  /**
   * Estimate token count for a text
   * Uses a simple heuristic based on word/character count
   * More accurate estimation would require a tokenizer
   * @param text - The text to estimate tokens for
   * @returns Estimated token count
   */
  countTokens(text: string): number {
    if (!text) return 0;

    // Simple estimation: ~4 characters per token for English text
    // This is a rough approximation; actual tokenization varies by model
    const charCount = text.length;
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    // Use a blend of character and word-based estimation
    // cl100k_base tokenizer (used by text-embedding-3) typically:
    // - Short words: 1 token
    // - Long words: may split into multiple tokens
    // - Punctuation: often separate tokens
    const charBasedEstimate = Math.ceil(charCount / 4);
    const wordBasedEstimate = Math.ceil(wordCount * 1.3); // ~1.3 tokens per word average

    return Math.max(charBasedEstimate, wordBasedEstimate);
  }

  /**
   * Generate embedding for a long document by chunking and combining
   * @param text - The full document text
   * @param maxChunkTokens - Maximum tokens per chunk
   * @returns Combined embedding for the entire document
   */
  async generateDocumentEmbedding(
    text: string,
    maxChunkTokens: number = 500,
  ): Promise<EmbeddingResult> {
    if (!text || !text.trim()) {
      throw new Error('Cannot generate embedding for empty document');
    }

    const chunks = this.chunkText(text, maxChunkTokens);

    if (chunks.length === 1) {
      return this.generateEmbedding(chunks[0].text);
    }

    this.logger.debug(`Generating embeddings for ${chunks.length} chunks`);

    // Generate embeddings for all chunks
    const chunkTexts = chunks.map((c) => c.text);
    const { embeddings, totalTokens } = await this.batchGenerateEmbeddings(chunkTexts);

    // Weight by chunk length (more content = more weight)
    const weights = chunks.map((c) => c.tokens);

    // Combine into single document embedding
    const combined = this.combineChunkEmbeddings(embeddings, weights);

    return {
      embedding: combined,
      tokens: totalTokens,
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private async callEmbeddingAPI(inputs: string[]): Promise<OpenAIEmbeddingResponse> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: this.embeddingModel,
        input: inputs,
        dimensions: this.embeddingDimensions,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<OpenAIEmbeddingResponse>;
  }

  private splitIntoSentences(text: string): string[] {
    // Split on sentence-ending punctuation while keeping the punctuation
    const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text];
    return sentences.filter((s) => s.trim());
  }

  private splitLongSentence(sentence: string, maxTokens: number): ChunkInfo[] {
    const words = sentence.split(/\s+/);
    const chunks: ChunkInfo[] = [];

    let currentChunk = '';
    let currentTokens = 0;

    for (const word of words) {
      const wordTokens = this.countTokens(word + ' ');

      if (currentTokens + wordTokens > maxTokens && currentChunk) {
        chunks.push({
          text: currentChunk.trim(),
          startIndex: 0, // Relative position not tracked for word splits
          endIndex: 0,
          tokens: currentTokens,
        });
        currentChunk = word + ' ';
        currentTokens = wordTokens;
      } else {
        currentChunk += word + ' ';
        currentTokens += wordTokens;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        startIndex: 0,
        endIndex: 0,
        tokens: currentTokens,
      });
    }

    return chunks;
  }

  private getOverlapText(sentences: string[], currentIndex: number, targetTokens: number): string {
    if (currentIndex === 0) return '';

    let overlap = '';
    let overlapTokens = 0;

    // Go backwards through sentences to build overlap
    for (let i = currentIndex - 1; i >= 0 && overlapTokens < targetTokens; i--) {
      const sentence = sentences[i];
      const sentenceTokens = this.countTokens(sentence);

      if (overlapTokens + sentenceTokens <= targetTokens * 1.5) {
        overlap = sentence + overlap;
        overlapTokens += sentenceTokens;
      } else {
        break;
      }
    }

    return overlap;
  }

  private truncateToTokenLimit(text: string, maxTokens: number): string {
    // Estimate characters based on token limit
    const targetChars = maxTokens * 4; // ~4 chars per token

    if (text.length <= targetChars) {
      return text;
    }

    // Truncate and try to end at a word boundary
    let truncated = text.slice(0, targetChars);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > targetChars * 0.8) {
      truncated = truncated.slice(0, lastSpace);
    }

    return truncated + '...';
  }
}
