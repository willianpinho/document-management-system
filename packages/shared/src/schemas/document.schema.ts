/**
 * Document Zod schemas.
 * @module @dms/shared/schemas/document
 */

import { z } from 'zod';

import { dateRangeSchema, paginationSchema, sortSchema, uuidSchema } from './common.schema.js';

/**
 * Document status schema.
 */
export const documentStatusSchema = z.enum([
  'uploading',
  'uploaded',
  'processing',
  'ready',
  'error',
  'deleted',
]);

/**
 * Processing status schema.
 */
export const processingStatusSchema = z.enum([
  'pending',
  'ocr_in_progress',
  'ocr_complete',
  'complete',
  'failed',
]);

/**
 * Document category schema.
 */
export const documentCategorySchema = z.enum([
  'invoice',
  'contract',
  'report',
  'letter',
  'image',
  'spreadsheet',
  'presentation',
  'legal',
  'financial',
  'other',
]);

/**
 * MIME type validation schema.
 */
export const mimeTypeSchema = z
  .string()
  .regex(/^[a-z]+\/[a-z0-9.+-]+$/i, 'Invalid MIME type format');

/**
 * Document name schema.
 */
export const documentNameSchema = z
  .string()
  .min(1, 'Document name is required')
  .max(255, 'Document name must be at most 255 characters')
  .regex(/^[^<>:"/\\|?*\x00-\x1f]+$/, 'Invalid characters in document name');

/**
 * Tag schema.
 */
export const tagSchema = z
  .string()
  .min(1, 'Tag cannot be empty')
  .max(50, 'Tag must be at most 50 characters')
  .transform((tag) => tag.toLowerCase().trim());

/**
 * Tags array schema.
 */
export const tagsArraySchema = z.array(tagSchema).max(20, 'Maximum 20 tags allowed');

/**
 * Document metadata update schema.
 */
export const documentMetadataSchema = z.object({
  title: z.string().max(500, 'Title must be at most 500 characters').optional(),
  description: z.string().max(5000, 'Description must be at most 5000 characters').optional(),
  tags: tagsArraySchema.optional(),
  custom: z.record(z.string(), z.string()).optional(),
});

/**
 * Create document schema (for initiating upload).
 */
export const createDocumentSchema = z.object({
  name: documentNameSchema,
  mimeType: mimeTypeSchema,
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024 * 1024, 'File too large (max 10GB)'),
  folderId: uuidSchema.optional().nullable(),
  checksum: z.string().optional(),
});

/**
 * Update document schema.
 */
export const updateDocumentSchema = z.object({
  name: documentNameSchema.optional(),
  folderId: uuidSchema.optional().nullable(),
  metadata: documentMetadataSchema.optional(),
});

/**
 * Move document schema.
 */
export const moveDocumentSchema = z.object({
  targetFolderId: uuidSchema.nullable(),
});

/**
 * Document search query schema.
 */
export const documentSearchSchema = paginationSchema.merge(sortSchema).extend({
  q: z.string().optional(),
  folderId: uuidSchema.optional(),
  mimeType: mimeTypeSchema.optional(),
  status: documentStatusSchema.optional(),
  category: documentCategorySchema.optional(),
  tags: z.string().optional(), // Comma-separated
  createdById: uuidSchema.optional(),
  extension: z.string().optional(),
  minSize: z.coerce.number().int().min(0).optional(),
  maxSize: z.coerce.number().int().min(0).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  includeDeleted: z.coerce.boolean().default(false),
});

/**
 * Semantic search schema.
 */
export const semanticSearchSchema = z.object({
  query: z.string().min(1, 'Query is required').max(1000, 'Query too long'),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  threshold: z.coerce.number().min(0).max(1).default(0.7),
  folderId: uuidSchema.optional(),
  mimeTypes: z.array(mimeTypeSchema).optional(),
  includeScore: z.coerce.boolean().default(true),
  rerank: z.coerce.boolean().default(false),
});

/**
 * Bulk document operation schema.
 */
export const bulkDocumentOperationSchema = z.object({
  documentIds: z.array(uuidSchema).min(1, 'At least one document required').max(100, 'Maximum 100 documents'),
  operation: z.enum(['move', 'delete', 'restore', 'download']),
  targetFolderId: uuidSchema.optional().nullable(),
});

/**
 * Document version comment schema.
 */
export const documentVersionCommentSchema = z.object({
  comment: z.string().max(1000, 'Comment must be at most 1000 characters').optional(),
});

/**
 * Download options schema.
 */
export const downloadOptionsSchema = z.object({
  versionId: uuidSchema.optional(),
  inline: z.coerce.boolean().default(false),
  expiresIn: z.coerce.number().int().min(60).max(86400).default(3600), // 1 hour default
});

/**
 * Inferred types from schemas.
 */
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type MoveDocumentInput = z.infer<typeof moveDocumentSchema>;
export type DocumentSearchInput = z.infer<typeof documentSearchSchema>;
export type SemanticSearchInput = z.infer<typeof semanticSearchSchema>;
export type BulkDocumentOperationInput = z.infer<typeof bulkDocumentOperationSchema>;
export type DocumentVersionCommentInput = z.infer<typeof documentVersionCommentSchema>;
export type DownloadOptionsInput = z.infer<typeof downloadOptionsSchema>;
