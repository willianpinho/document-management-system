/**
 * Queue Types
 *
 * TypeScript interfaces and types for job data across all queues.
 */

/**
 * Base job data interface - all jobs inherit from this
 */
export interface BaseJobData {
  documentId: string;
  organizationId: string;
  s3Key: string;
  requestedBy?: string;
  correlationId?: string;
}

/**
 * OCR Job Data
 */
export interface OcrJobData extends BaseJobData {
  language?: string;
  detectTables?: boolean;
  detectForms?: boolean;
}

/**
 * PDF Split Job Data
 */
export interface PdfSplitJobData extends BaseJobData {
  /**
   * Page ranges to extract (e.g., "1-5,8,10-12")
   */
  pageRanges?: string;
  /**
   * Split every N pages into separate documents
   */
  splitEvery?: number;
  /**
   * Output file name pattern (uses {n} for page number)
   */
  outputNamePattern?: string;
}

/**
 * PDF Merge Job Data
 */
export interface PdfMergeJobData {
  organizationId: string;
  documentIds: string[];
  outputName: string;
  outputFolderId?: string;
  requestedBy?: string;
  correlationId?: string;
}

/**
 * Thumbnail Job Data
 */
export interface ThumbnailJobData extends BaseJobData {
  size?: 'small' | 'medium' | 'large';
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number;
}

/**
 * Embedding Job Data
 */
export interface EmbeddingJobData extends BaseJobData {
  model?: string;
  chunkSize?: number;
  overlap?: number;
}

/**
 * AI Classification Job Data
 */
export interface AiClassifyJobData extends BaseJobData {
  categories?: string[];
  extractEntities?: boolean;
  generateSummary?: boolean;
}

/**
 * Union type for all job data types
 */
export type ProcessingJobData =
  | OcrJobData
  | PdfSplitJobData
  | PdfMergeJobData
  | ThumbnailJobData
  | EmbeddingJobData
  | AiClassifyJobData;

/**
 * Job result interfaces
 */
export interface OcrJobResult {
  extractedText: string;
  textLength: number;
  blockCount: number;
  tables?: unknown[];
  forms?: unknown[];
}

export interface PdfSplitJobResult {
  outputKeys: string[];
  outputDocumentIds: string[];
  splitCount: number;
}

export interface PdfMergeJobResult {
  outputKey: string;
  outputDocumentId: string;
  mergedCount: number;
}

export interface ThumbnailJobResult {
  thumbnailKey: string;
  size: string;
  dimensions: { width: number; height: number };
}

export interface EmbeddingJobResult {
  embeddingDimensions: number;
  chunks: number;
  model: string;
}

export interface AiClassifyJobResult {
  category: string;
  confidence: number;
  language?: string;
  tags?: string[];
  summary?: string;
  entities?: Record<string, string[]>;
}

/**
 * Union type for all job results
 */
export type ProcessingJobResult =
  | OcrJobResult
  | PdfSplitJobResult
  | PdfMergeJobResult
  | ThumbnailJobResult
  | EmbeddingJobResult
  | AiClassifyJobResult;

/**
 * Queue statistics interface
 */
export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

/**
 * Aggregated queue statistics
 */
export interface AggregatedQueueStats {
  queues: Record<string, QueueStats>;
  totals: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
}
