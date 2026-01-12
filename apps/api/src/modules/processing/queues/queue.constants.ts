/**
 * Queue Constants
 *
 * Defines all queue names and their configurations for the processing module.
 */

/**
 * Legacy queue name for backward compatibility
 * @deprecated Use QUEUE_NAMES for new implementations
 */
export const DOCUMENT_PROCESSING_QUEUE = 'document-processing';

/**
 * Queue names for different processing types
 */
export const QUEUE_NAMES = {
  OCR: 'ocr-queue',
  PDF: 'pdf-queue',
  THUMBNAIL: 'thumbnail-queue',
  EMBEDDING: 'embedding-queue',
  AI_CLASSIFY: 'ai-classify-queue',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * Job names within each queue
 */
export const JOB_NAMES = {
  // OCR Queue
  OCR_DOCUMENT: 'ocr-document',
  OCR_IMAGE: 'ocr-image',

  // PDF Queue
  PDF_SPLIT: 'pdf-split',
  PDF_MERGE: 'pdf-merge',
  PDF_EXTRACT_PAGES: 'pdf-extract-pages',

  // Thumbnail Queue
  GENERATE_THUMBNAIL: 'generate-thumbnail',
  GENERATE_PREVIEW: 'generate-preview',

  // Embedding Queue
  GENERATE_EMBEDDING: 'generate-embedding',
  UPDATE_EMBEDDING: 'update-embedding',

  // AI Classify Queue
  CLASSIFY_DOCUMENT: 'classify-document',
  EXTRACT_ENTITIES: 'extract-entities',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

/**
 * Processing job types (for database tracking)
 */
export type ProcessingJobType =
  | 'OCR'
  | 'PDF_SPLIT'
  | 'PDF_MERGE'
  | 'PDF_WATERMARK'
  | 'PDF_COMPRESS'
  | 'PDF_EXTRACT_PAGES'
  | 'PDF_RENDER_PAGE'
  | 'PDF_METADATA'
  | 'THUMBNAIL'
  | 'AI_CLASSIFY'
  | 'EMBEDDING';

/**
 * Processing job status
 */
export type ProcessingJobStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'STALLED';

/**
 * Queue priorities (lower number = higher priority)
 */
export const QUEUE_PRIORITIES = {
  CRITICAL: 1,
  HIGH: 2,
  NORMAL: 3,
  LOW: 4,
  BACKGROUND: 5,
} as const;

/**
 * Default priority mapping for job types
 */
export const JOB_TYPE_PRIORITIES: Record<ProcessingJobType, number> = {
  THUMBNAIL: QUEUE_PRIORITIES.HIGH, // User-facing, needs fast response
  OCR: QUEUE_PRIORITIES.NORMAL,
  AI_CLASSIFY: QUEUE_PRIORITIES.NORMAL,
  EMBEDDING: QUEUE_PRIORITIES.LOW,
  PDF_SPLIT: QUEUE_PRIORITIES.LOW,
  PDF_MERGE: QUEUE_PRIORITIES.LOW,
  PDF_WATERMARK: QUEUE_PRIORITIES.LOW,
  PDF_COMPRESS: QUEUE_PRIORITIES.LOW,
  PDF_EXTRACT_PAGES: QUEUE_PRIORITIES.LOW,
  PDF_RENDER_PAGE: QUEUE_PRIORITIES.NORMAL,
  PDF_METADATA: QUEUE_PRIORITIES.NORMAL,
};

/**
 * Retry configuration defaults
 */
export const DEFAULT_RETRY_CONFIG = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000, // 2 seconds initial delay
  },
};

/**
 * Job cleanup configuration
 */
export const JOB_CLEANUP_CONFIG = {
  // Remove completed jobs after 7 days
  removeOnComplete: {
    age: 7 * 24 * 3600, // 7 days in seconds
    count: 10000, // Keep max 10000 completed jobs
  },
  // Remove failed jobs after 30 days
  removeOnFail: {
    age: 30 * 24 * 3600, // 30 days in seconds
    count: 5000, // Keep max 5000 failed jobs
  },
};
