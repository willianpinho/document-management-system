/**
 * Thumbnail Queue Configuration
 *
 * Handles thumbnail and preview generation using Sharp.
 *
 * Rate Limit: None (local CPU-bound operations)
 * Concurrency: 10 (lightweight operations)
 */

import { RegisterQueueOptions } from '@nestjs/bullmq';
import { QUEUE_NAMES, DEFAULT_RETRY_CONFIG, JOB_CLEANUP_CONFIG } from './queue.constants';

export const THUMBNAIL_QUEUE_CONFIG: RegisterQueueOptions = {
  name: QUEUE_NAMES.THUMBNAIL,
  defaultJobOptions: {
    ...DEFAULT_RETRY_CONFIG,
    removeOnComplete: JOB_CLEANUP_CONFIG.removeOnComplete,
    removeOnFail: JOB_CLEANUP_CONFIG.removeOnFail,
    // Thumbnails have higher priority as they're user-facing
    priority: 2,
  },
};

/**
 * Thumbnail Queue processor options
 */
export const THUMBNAIL_PROCESSOR_OPTIONS = {
  concurrency: 10,
  // No rate limiting for thumbnail generation
};

/**
 * Thumbnail size presets
 */
export const THUMBNAIL_SIZES = {
  small: { width: 100, height: 100 },
  medium: { width: 300, height: 300 },
  large: { width: 600, height: 600 },
} as const;

/**
 * Thumbnail-specific configuration
 */
export const THUMBNAIL_CONFIG = {
  // Default size
  defaultSize: 'medium' as keyof typeof THUMBNAIL_SIZES,
  // Default format
  defaultFormat: 'png' as const,
  // Default quality for lossy formats
  defaultQuality: 80,
  // Maximum input file size (50MB)
  maxInputSize: 50 * 1024 * 1024,
  // Supported input types
  supportedTypes: [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/tiff',
    'application/pdf',
  ],
  // Timeout (30 seconds)
  timeout: 30 * 1000,
};
