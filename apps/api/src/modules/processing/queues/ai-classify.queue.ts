/**
 * AI Classification Queue Configuration
 *
 * Handles AI-powered document classification using GPT-4.
 *
 * Rate Limit: 20 jobs per minute (GPT-4 rate limits and cost control)
 * Concurrency: 2 (controlled parallelism for cost management)
 */

import { RegisterQueueOptions } from '@nestjs/bullmq';
import { QUEUE_NAMES, DEFAULT_RETRY_CONFIG, JOB_CLEANUP_CONFIG } from './queue.constants';

export const AI_CLASSIFY_QUEUE_CONFIG: RegisterQueueOptions = {
  name: QUEUE_NAMES.AI_CLASSIFY,
  defaultJobOptions: {
    ...DEFAULT_RETRY_CONFIG,
    removeOnComplete: JOB_CLEANUP_CONFIG.removeOnComplete,
    removeOnFail: JOB_CLEANUP_CONFIG.removeOnFail,
    // Normal priority for classification
    priority: 3,
  },
};

/**
 * AI Classification Queue processor options
 */
export const AI_CLASSIFY_PROCESSOR_OPTIONS = {
  concurrency: 2,
  limiter: {
    max: 20,
    duration: 60000, // 20 jobs per minute
  },
};

/**
 * AI Classification-specific configuration
 */
export const AI_CLASSIFY_CONFIG = {
  // Default model
  defaultModel: 'gpt-4-turbo-preview',
  // Default categories for classification
  defaultCategories: [
    'Invoice',
    'Contract',
    'Report',
    'Letter',
    'Receipt',
    'Form',
    'Presentation',
    'Spreadsheet',
    'Image',
    'Other',
  ],
  // Maximum text length to send to GPT
  maxTextLength: 4000,
  // Temperature for classification (lower = more deterministic)
  temperature: 0.3,
  // Maximum tokens in response
  maxResponseTokens: 500,
  // Timeout (3 minutes)
  timeout: 3 * 60 * 1000,
  // Prompt template for classification
  classificationPrompt: `Analyze the following document and provide a classification.

Document Name: {fileName}
Content (first 2000 chars): {content}

Provide a JSON response with:
- category: The document category (one of: {categories})
- confidence: Confidence score 0-1
- language: Detected language code (e.g., "en", "pt", "es")
- tags: Array of relevant tags (max 5)
- summary: Brief 1-2 sentence summary

Respond only with valid JSON.`,
};
