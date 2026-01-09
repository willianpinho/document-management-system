/**
 * Processing job Zod schemas.
 * @module @dms/shared/schemas/processing
 */

import { z } from 'zod';

import { uuidSchema } from './common.schema.js';

/**
 * Processing job type schema.
 */
export const processingJobTypeSchema = z.enum([
  'ocr',
  'pdf_split',
  'pdf_merge',
  'thumbnail',
  'ai_classify',
  'embedding',
  'convert',
  'compress',
]);

/**
 * Processing job status schema.
 */
export const processingJobStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
  'retrying',
]);

/**
 * Processing priority schema.
 */
export const processingPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);

/**
 * PDF split rule type schema.
 */
export const pdfSplitRuleTypeSchema = z.enum([
  'page_range',
  'page_count',
  'bookmark',
  'blank_page',
]);

/**
 * PDF split rule schema.
 */
export const pdfSplitRuleSchema = z.object({
  type: pdfSplitRuleTypeSchema,
  startPage: z.number().int().positive().optional(),
  endPage: z.number().int().positive().optional(),
  pagesPerDocument: z.number().int().positive().optional(),
  bookmarkLevel: z.number().int().positive().max(5).optional(),
});

/**
 * Thumbnail format schema.
 */
export const thumbnailFormatSchema = z.enum(['jpeg', 'png', 'webp']);

/**
 * OCR features schema.
 */
export const ocrFeaturesSchema = z.array(z.enum(['TABLES', 'FORMS', 'QUERIES']));

/**
 * Job input parameters schema.
 */
export const jobInputParamsSchema = z.object({
  // OCR options
  features: ocrFeaturesSchema.optional(),
  language: z.string().length(2).optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),

  // PDF Split options
  splitRules: z.array(pdfSplitRuleSchema).optional(),
  documentNames: z.array(z.string()).optional(),

  // PDF Merge options
  documentIds: z.array(uuidSchema).optional(),
  mergedDocumentName: z.string().max(255).optional(),

  // Thumbnail options
  width: z.number().int().positive().max(4000).optional(),
  height: z.number().int().positive().max(4000).optional(),
  format: thumbnailFormatSchema.optional(),
  quality: z.number().int().min(1).max(100).optional(),
  pages: z.array(z.number().int().positive()).optional(),

  // AI Classify options
  model: z.string().optional(),
  customCategories: z.array(z.string()).max(20).optional(),
  extractEntities: z.boolean().optional(),
  generateSummary: z.boolean().optional(),

  // Embedding options
  embeddingModel: z.string().optional(),
  chunkSize: z.number().int().min(100).max(8000).optional(),
  chunkOverlap: z.number().int().min(0).max(500).optional(),

  // Convert options
  targetFormat: z.string().optional(),
  conversionOptions: z.record(z.string(), z.unknown()).optional(),

  // Generic options
  priority: processingPrioritySchema.optional().default('normal'),
  callbackUrl: z.string().url().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Create processing job schema.
 */
export const createProcessingJobSchema = z.object({
  documentId: uuidSchema,
  jobType: processingJobTypeSchema,
  inputParams: jobInputParamsSchema.optional(),
  priority: processingPrioritySchema.optional().default('normal'),
});

/**
 * Trigger processing schema (simpler version for document endpoint).
 */
export const triggerProcessingSchema = z.object({
  type: processingJobTypeSchema,
  options: jobInputParamsSchema.optional(),
});

/**
 * Bulk processing schema.
 */
export const bulkProcessingSchema = z.object({
  documentIds: z.array(uuidSchema).min(1).max(100),
  jobType: processingJobTypeSchema,
  inputParams: jobInputParamsSchema.optional(),
  priority: processingPrioritySchema.optional().default('normal'),
});

/**
 * Cancel job schema.
 */
export const cancelJobSchema = z.object({
  jobId: uuidSchema,
  reason: z.string().max(500).optional(),
});

/**
 * Retry job schema.
 */
export const retryJobSchema = z.object({
  jobId: uuidSchema,
  modifiedParams: jobInputParamsSchema.optional(),
});

/**
 * Processing jobs query schema.
 */
export const processingJobsQuerySchema = z.object({
  documentId: uuidSchema.optional(),
  jobType: processingJobTypeSchema.optional(),
  status: processingJobStatusSchema.optional(),
  priority: processingPrioritySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'startedAt', 'completedAt', 'status']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Inferred types from schemas.
 */
export type CreateProcessingJobInput = z.infer<typeof createProcessingJobSchema>;
export type TriggerProcessingInput = z.infer<typeof triggerProcessingSchema>;
export type BulkProcessingInput = z.infer<typeof bulkProcessingSchema>;
export type CancelJobInput = z.infer<typeof cancelJobSchema>;
export type RetryJobInput = z.infer<typeof retryJobSchema>;
export type ProcessingJobsQueryInput = z.infer<typeof processingJobsQuerySchema>;
export type JobInputParamsInput = z.infer<typeof jobInputParamsSchema>;
