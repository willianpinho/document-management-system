/**
 * Embedding Queue Configuration
 *
 * Handles vector embedding generation using OpenAI API.
 *
 * Rate Limit: 60 jobs per minute (OpenAI rate limits)
 * Concurrency: 3 (parallel API calls)
 */

import { RegisterQueueOptions } from '@nestjs/bullmq';
import { QUEUE_NAMES, DEFAULT_RETRY_CONFIG, JOB_CLEANUP_CONFIG } from './queue.constants';

export const EMBEDDING_QUEUE_CONFIG: RegisterQueueOptions = {
  name: QUEUE_NAMES.EMBEDDING,
  defaultJobOptions: {
    ...DEFAULT_RETRY_CONFIG,
    removeOnComplete: JOB_CLEANUP_CONFIG.removeOnComplete,
    removeOnFail: JOB_CLEANUP_CONFIG.removeOnFail,
    // Lower priority for embeddings
    priority: 4,
  },
};

/**
 * Embedding Queue processor options
 */
export const EMBEDDING_PROCESSOR_OPTIONS = {
  concurrency: 3,
  limiter: {
    max: 60,
    duration: 60000, // 60 jobs per minute
  },
};

/**
 * Embedding-specific configuration
 */
export const EMBEDDING_CONFIG = {
  // Default model
  defaultModel: 'text-embedding-ada-002',
  // Embedding dimensions by model
  modelDimensions: {
    'text-embedding-ada-002': 1536,
    'text-embedding-3-small': 1536,
    'text-embedding-3-large': 3072,
  } as Record<string, number>,
  // Maximum tokens per request (8191 for ada-002)
  maxTokens: 8191,
  // Approximate characters per token
  charsPerToken: 4,
  // Maximum characters for embedding
  maxCharacters: 32000,
  // Default chunk size for long documents
  defaultChunkSize: 1000,
  // Default overlap between chunks
  defaultOverlap: 200,
  // Timeout (2 minutes)
  timeout: 2 * 60 * 1000,
};
