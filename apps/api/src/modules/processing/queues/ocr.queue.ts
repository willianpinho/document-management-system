/**
 * OCR Queue Configuration
 *
 * Handles OCR processing jobs using AWS Textract.
 *
 * Rate Limit: 10 jobs per minute (AWS Textract API limits)
 * Concurrency: 2 (to stay within AWS limits)
 */

import { RegisterQueueOptions } from '@nestjs/bullmq';
import { QUEUE_NAMES, DEFAULT_RETRY_CONFIG, JOB_CLEANUP_CONFIG } from './queue.constants';

export const OCR_QUEUE_CONFIG: RegisterQueueOptions = {
  name: QUEUE_NAMES.OCR,
  defaultJobOptions: {
    ...DEFAULT_RETRY_CONFIG,
    removeOnComplete: JOB_CLEANUP_CONFIG.removeOnComplete,
    removeOnFail: JOB_CLEANUP_CONFIG.removeOnFail,
  },
};

/**
 * OCR Queue processor options
 */
export const OCR_PROCESSOR_OPTIONS = {
  concurrency: 2,
  limiter: {
    max: 10,
    duration: 60000, // 10 jobs per minute
  },
};

/**
 * OCR-specific configuration
 */
export const OCR_CONFIG = {
  // Maximum document size for synchronous OCR (5MB)
  maxSyncDocumentSize: 5 * 1024 * 1024,
  // Supported document types
  supportedTypes: [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/tiff',
  ],
  // Timeout for OCR operations (5 minutes)
  timeout: 5 * 60 * 1000,
};
