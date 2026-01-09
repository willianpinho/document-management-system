/**
 * Processing job type definitions for the Document Management System.
 * @module @dms/shared/types/processing
 */

import type { BoundingBox, DocumentClassification, ExtractedEntity } from './document.js';

/**
 * Types of processing jobs that can be queued.
 */
export const ProcessingJobType = {
  /** Optical Character Recognition to extract text */
  OCR: 'ocr',
  /** Split PDF into multiple documents */
  PDF_SPLIT: 'pdf_split',
  /** Merge multiple PDFs into one */
  PDF_MERGE: 'pdf_merge',
  /** Generate thumbnail images */
  THUMBNAIL: 'thumbnail',
  /** AI-powered document classification */
  AI_CLASSIFY: 'ai_classify',
  /** Generate vector embeddings for semantic search */
  EMBEDDING: 'embedding',
  /** Convert document to different format */
  CONVERT: 'convert',
  /** Compress/optimize document */
  COMPRESS: 'compress',
} as const;

export type ProcessingJobType = (typeof ProcessingJobType)[keyof typeof ProcessingJobType];

/**
 * Status of a processing job in the queue.
 */
export const ProcessingJobStatus = {
  /** Job is waiting to be processed */
  PENDING: 'pending',
  /** Job is currently being processed */
  RUNNING: 'running',
  /** Job completed successfully */
  COMPLETED: 'completed',
  /** Job failed with an error */
  FAILED: 'failed',
  /** Job was cancelled by user */
  CANCELLED: 'cancelled',
  /** Job is waiting for retry after failure */
  RETRYING: 'retrying',
} as const;

export type ProcessingJobStatus = (typeof ProcessingJobStatus)[keyof typeof ProcessingJobStatus];

/**
 * Priority levels for processing jobs.
 */
export const ProcessingPriority = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export type ProcessingPriority = (typeof ProcessingPriority)[keyof typeof ProcessingPriority];

/**
 * PDF split rule types.
 */
export const PdfSplitRuleType = {
  /** Split at specific page ranges */
  PAGE_RANGE: 'page_range',
  /** Split into documents of N pages each */
  PAGE_COUNT: 'page_count',
  /** Split at bookmark boundaries */
  BOOKMARK: 'bookmark',
  /** Split at blank pages */
  BLANK_PAGE: 'blank_page',
} as const;

export type PdfSplitRuleType = (typeof PdfSplitRuleType)[keyof typeof PdfSplitRuleType];

/**
 * Rule for splitting a PDF document.
 */
export interface PdfSplitRule {
  /** Type of split rule */
  type: PdfSplitRuleType;
  /** Starting page (for page_range) */
  startPage?: number;
  /** Ending page (for page_range) */
  endPage?: number;
  /** Pages per document (for page_count) */
  pagesPerDocument?: number;
  /** Bookmark level to split at (for bookmark) */
  bookmarkLevel?: number;
}

/**
 * Page range specification.
 */
export interface PageRange {
  /** Starting page (1-indexed) */
  start: number;
  /** Ending page (1-indexed, inclusive) */
  end: number;
}

/**
 * Input parameters for processing jobs.
 */
export interface JobInputParams {
  // OCR options
  /** Features to extract (tables, forms, queries) */
  features?: ('TABLES' | 'FORMS' | 'QUERIES')[];
  /** Document language (ISO 639-1 code) */
  language?: string;
  /** OCR confidence threshold (0-1) */
  confidenceThreshold?: number;

  // PDF Split options
  /** Rules for splitting the PDF */
  splitRules?: PdfSplitRule[];
  /** Custom names for split documents */
  documentNames?: string[];

  // PDF Merge options
  /** Document IDs to merge (in order) */
  documentIds?: string[];
  /** Name for the merged document */
  mergedDocumentName?: string;

  // Thumbnail options
  /** Thumbnail width in pixels */
  width?: number;
  /** Thumbnail height in pixels */
  height?: number;
  /** Output format */
  format?: 'jpeg' | 'png' | 'webp';
  /** Quality (1-100) */
  quality?: number;
  /** Pages to generate thumbnails for (empty = first page only) */
  pages?: number[];

  // AI Classify options
  /** AI model to use */
  model?: string;
  /** Custom categories to classify into */
  customCategories?: string[];
  /** Whether to extract entities */
  extractEntities?: boolean;
  /** Whether to generate summary */
  generateSummary?: boolean;

  // Embedding options
  /** Embedding model to use */
  embeddingModel?: string;
  /** Chunk size for embedding generation */
  chunkSize?: number;
  /** Chunk overlap */
  chunkOverlap?: number;

  // Convert options
  /** Target format for conversion */
  targetFormat?: string;
  /** Conversion options */
  conversionOptions?: Record<string, unknown>;

  // Generic options
  /** Job priority */
  priority?: ProcessingPriority;
  /** Callback URL for completion notification */
  callbackUrl?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * OCR table structure extracted from document.
 */
export interface OcrTable {
  /** Table rows */
  rows: OcrTableRow[];
  /** Overall confidence score */
  confidence: number;
  /** Location in document */
  boundingBox?: BoundingBox;
  /** Page number */
  pageNumber?: number;
  /** Table title (if detected) */
  title?: string;
}

/**
 * Row in an OCR table.
 */
export interface OcrTableRow {
  /** Cells in this row */
  cells: OcrTableCell[];
  /** Whether this is a header row */
  isHeader?: boolean;
}

/**
 * Cell in an OCR table.
 */
export interface OcrTableCell {
  /** Cell text content */
  text: string;
  /** Confidence score */
  confidence: number;
  /** Column index (0-based) */
  columnIndex: number;
  /** Row index (0-based) */
  rowIndex: number;
  /** Column span */
  columnSpan: number;
  /** Row span */
  rowSpan: number;
  /** Location in document */
  boundingBox?: BoundingBox;
}

/**
 * Form field extracted via OCR.
 */
export interface OcrFormField {
  /** Field label/key */
  key: string;
  /** Field value */
  value: string;
  /** Confidence score */
  confidence: number;
  /** Key location */
  keyBoundingBox?: BoundingBox;
  /** Value location */
  valueBoundingBox?: BoundingBox;
  /** Page number */
  pageNumber?: number;
}

/**
 * Output data from processing jobs.
 */
export interface JobOutputData {
  // OCR output
  /** Extracted text content */
  text?: string;
  /** Extracted tables */
  tables?: OcrTable[];
  /** Extracted form fields */
  forms?: OcrFormField[];
  /** Overall OCR confidence */
  confidence?: number;
  /** Word-level details */
  words?: Array<{
    text: string;
    confidence: number;
    boundingBox: BoundingBox;
    pageNumber: number;
  }>;

  // PDF Split output
  /** IDs of resulting split documents */
  resultDocumentIds?: string[];
  /** Page ranges for each split document */
  pageRanges?: PageRange[];

  // PDF Merge output
  /** ID of the merged document */
  mergedDocumentId?: string;
  /** Total page count of merged document */
  totalPages?: number;

  // Thumbnail output
  /** Primary thumbnail URL */
  thumbnailUrl?: string;
  /** S3 key for thumbnail */
  thumbnailKey?: string;
  /** All generated thumbnails */
  thumbnails?: Array<{
    url: string;
    key: string;
    width: number;
    height: number;
    format: string;
    pageNumber: number;
  }>;

  // AI Classify output
  /** Document classification result */
  classification?: DocumentClassification;
  /** Extracted entities */
  entities?: ExtractedEntity[];
  /** AI-generated summary */
  summary?: string;
  /** Key phrases extracted */
  keyPhrases?: string[];
  /** Detected language */
  detectedLanguage?: string;

  // Embedding output
  /** Generated embedding vector */
  vector?: number[];
  /** Embedding model used */
  model?: string;
  /** Number of chunks processed */
  chunksProcessed?: number;

  // Convert output
  /** Converted document ID */
  convertedDocumentId?: string;
  /** Original format */
  originalFormat?: string;
  /** Target format */
  convertedFormat?: string;

  // Compress output
  /** Original size in bytes */
  originalSizeBytes?: number;
  /** Compressed size in bytes */
  compressedSizeBytes?: number;
  /** Compression ratio (0-1) */
  compressionRatio?: number;

  // Generic output
  /** Processing time in milliseconds */
  processingTimeMs?: number;
  /** Warnings generated during processing */
  warnings?: string[];
}

/**
 * Core processing job entity.
 */
export interface ProcessingJob {
  /** Unique identifier */
  id: string;
  /** Document being processed */
  documentId: string;
  /** Organization ID */
  organizationId: string;
  /** Type of processing job */
  jobType: ProcessingJobType;
  /** Current job status */
  status: ProcessingJobStatus;
  /** Job priority */
  priority: ProcessingPriority;
  /** Input parameters */
  inputParams: JobInputParams;
  /** Output data (populated on completion) */
  outputData: JobOutputData | null;
  /** Error message (if failed) */
  errorMessage: string | null;
  /** Error code (if failed) */
  errorCode: string | null;
  /** Number of retry attempts */
  retryCount: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** When the job started processing */
  startedAt: Date | null;
  /** When the job completed */
  completedAt: Date | null;
  /** When the job was created */
  createdAt: Date;
  /** User who created the job */
  createdById: string;
}

/**
 * Processing job with document details included.
 */
export interface ProcessingJobWithDocument extends ProcessingJob {
  /** Associated document */
  document: {
    id: string;
    name: string;
    mimeType: string;
    sizeBytes: bigint;
  };
}

/**
 * Data transfer object for creating a processing job.
 */
export interface CreateProcessingJobDto {
  /** Document ID to process */
  documentId: string;
  /** Type of processing */
  jobType: ProcessingJobType;
  /** Processing parameters */
  inputParams?: JobInputParams;
  /** Job priority */
  priority?: ProcessingPriority;
}

/**
 * Data transfer object for triggering processing on a document.
 */
export interface TriggerProcessingDto {
  /** Type of processing */
  type: ProcessingJobType;
  /** Processing options */
  options?: JobInputParams;
}

/**
 * Real-time processing progress update.
 */
export interface ProcessingProgress {
  /** Job ID */
  jobId: string;
  /** Current status */
  status: ProcessingJobStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** Current step description */
  message?: string;
  /** Current step number */
  currentStep?: number;
  /** Total steps */
  totalSteps?: number;
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining?: number;
}

/**
 * OCR-specific result type.
 */
export interface OcrResult {
  /** Extracted text */
  text: string;
  /** Tables found */
  tables: OcrTable[];
  /** Form fields found */
  forms: OcrFormField[];
  /** Overall confidence */
  confidence: number;
  /** Page-by-page results */
  pages: Array<{
    pageNumber: number;
    text: string;
    confidence: number;
    tables: OcrTable[];
    forms: OcrFormField[];
  }>;
}

/**
 * PDF split result type.
 */
export interface PdfSplitResult {
  /** Resulting document IDs */
  documentIds: string[];
  /** Page ranges for each document */
  pageRanges: PageRange[];
  /** Original page count */
  originalPageCount: number;
}

/**
 * Thumbnail generation result type.
 */
export interface ThumbnailResult {
  /** Generated thumbnails */
  thumbnails: Array<{
    url: string;
    key: string;
    width: number;
    height: number;
    format: 'jpeg' | 'png' | 'webp';
    pageNumber: number;
  }>;
}

/**
 * Processing queue statistics.
 */
export interface ProcessingQueueStats {
  /** Number of pending jobs */
  pending: number;
  /** Number of running jobs */
  running: number;
  /** Number of completed jobs (last 24h) */
  completedLast24h: number;
  /** Number of failed jobs (last 24h) */
  failedLast24h: number;
  /** Average processing time in ms */
  averageProcessingTimeMs: number;
  /** Jobs by type */
  byType: Record<ProcessingJobType, number>;
}
