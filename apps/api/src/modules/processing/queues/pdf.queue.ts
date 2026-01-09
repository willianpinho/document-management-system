/**
 * PDF Queue Configuration
 *
 * Handles PDF operations: split, merge, page extraction.
 *
 * Rate Limit: None (CPU-bound operations)
 * Concurrency: 5 (balanced for CPU usage)
 */

import { RegisterQueueOptions } from '@nestjs/bullmq';
import { QUEUE_NAMES, DEFAULT_RETRY_CONFIG, JOB_CLEANUP_CONFIG } from './queue.constants';

export const PDF_QUEUE_CONFIG: RegisterQueueOptions = {
  name: QUEUE_NAMES.PDF,
  defaultJobOptions: {
    ...DEFAULT_RETRY_CONFIG,
    removeOnComplete: JOB_CLEANUP_CONFIG.removeOnComplete,
    removeOnFail: JOB_CLEANUP_CONFIG.removeOnFail,
  },
};

/**
 * PDF Queue processor options
 */
export const PDF_PROCESSOR_OPTIONS = {
  concurrency: 5,
  // No rate limiting for PDF operations
};

/**
 * PDF-specific configuration
 */
export const PDF_CONFIG = {
  // Maximum PDF size for processing (100MB)
  maxPdfSize: 100 * 1024 * 1024,
  // Maximum pages for split operation
  maxPagesForSplit: 1000,
  // Maximum documents for merge operation
  maxDocumentsForMerge: 50,
  // Timeout for PDF operations (10 minutes)
  timeout: 10 * 60 * 1000,
};
