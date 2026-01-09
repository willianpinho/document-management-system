/**
 * Search Zod schemas.
 * @module @dms/shared/schemas/search
 */

import { z } from 'zod';

import { paginationSchema, uuidSchema } from './common.schema.js';
import { documentCategorySchema, documentStatusSchema, mimeTypeSchema } from './document.schema.js';

/**
 * Search mode schema.
 */
export const searchModeSchema = z.enum(['fulltext', 'semantic', 'hybrid']);

/**
 * Search field schema.
 */
export const searchFieldSchema = z.enum([
  'name',
  'content',
  'tags',
  'description',
  'metadata',
  'ocrText',
]);

/**
 * Date range filter schema.
 */
export const searchDateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

/**
 * Number range filter schema.
 */
export const searchNumberRangeSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
});

/**
 * Search filters schema.
 */
export const searchFiltersSchema = z.object({
  type: z.array(z.enum(['document', 'folder'])).optional(),
  folderId: uuidSchema.optional(),
  includeSubfolders: z.boolean().default(true),
  mimeTypes: z.array(mimeTypeSchema).optional(),
  extensions: z.array(z.string()).optional(),
  status: z.array(documentStatusSchema).optional(),
  categories: z.array(documentCategorySchema).optional(),
  tags: z.array(z.string()).optional(),
  tagsAny: z.array(z.string()).optional(),
  createdBy: uuidSchema.optional(),
  createdAt: searchDateRangeSchema.optional(),
  updatedAt: searchDateRangeSchema.optional(),
  sizeBytes: searchNumberRangeSchema.optional(),
  excludeIds: z.array(uuidSchema).optional(),
  includeIds: z.array(uuidSchema).optional(),
});

/**
 * Full-text search query schema.
 */
export const searchQuerySchema = z.object({
  query: z.string().min(1, 'Search query is required').max(500, 'Query too long'),
  mode: searchModeSchema.optional().default('fulltext'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  filters: searchFiltersSchema.optional(),
  searchFields: z.array(searchFieldSchema).optional(),
  highlight: z.boolean().default(true),
  includeFacets: z.boolean().default(false),
  facetFields: z.array(z.string()).optional(),
});

/**
 * Semantic search query schema.
 */
export const semanticSearchQuerySchema = z.object({
  query: z.string().min(1, 'Search query is required').max(1000, 'Query too long'),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  threshold: z.coerce.number().min(0).max(1).default(0.7),
  filters: searchFiltersSchema.optional(),
  includeScore: z.boolean().default(true),
  rerank: z.boolean().default(false),
});

/**
 * Autocomplete query schema.
 */
export const autocompleteQuerySchema = z.object({
  query: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(20).default(10),
  types: z.array(z.enum(['document', 'folder', 'tag', 'query'])).optional(),
  folderId: uuidSchema.optional(),
});

/**
 * Save search schema.
 */
export const saveSearchSchema = z.object({
  name: z.string().min(1).max(255),
  query: z.string().min(1).max(500),
  mode: searchModeSchema,
  filters: searchFiltersSchema.optional(),
  sort: z.object({
    field: z.string(),
    order: z.enum(['asc', 'desc']),
  }).optional(),
});

/**
 * Update saved search schema.
 */
export const updateSavedSearchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  filters: searchFiltersSchema.optional(),
  sort: z.object({
    field: z.string(),
    order: z.enum(['asc', 'desc']),
  }).optional(),
});

/**
 * Search history query schema.
 */
export const searchHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Inferred types from schemas.
 */
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
export type SemanticSearchQueryInput = z.infer<typeof semanticSearchQuerySchema>;
export type AutocompleteQueryInput = z.infer<typeof autocompleteQuerySchema>;
export type SaveSearchInput = z.infer<typeof saveSearchSchema>;
export type UpdateSavedSearchInput = z.infer<typeof updateSavedSearchSchema>;
export type SearchHistoryQueryInput = z.infer<typeof searchHistoryQuerySchema>;
export type SearchFiltersInput = z.infer<typeof searchFiltersSchema>;
