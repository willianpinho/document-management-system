/**
 * Common Zod schemas used across the application.
 * @module @dms/shared/schemas/common
 */

import { z } from 'zod';

/**
 * UUID v4 validation schema.
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Non-empty string schema.
 */
export const nonEmptyStringSchema = z.string().min(1, 'This field is required');

/**
 * URL validation schema.
 */
export const urlSchema = z.string().url('Invalid URL format');

/**
 * ISO date-time string schema.
 */
export const dateTimeSchema = z.string().datetime('Invalid date-time format');

/**
 * Pagination query parameters schema.
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

/**
 * Sort direction schema.
 */
export const sortDirectionSchema = z.enum(['asc', 'desc']);

/**
 * Sort query parameters schema.
 */
export const sortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: sortDirectionSchema.default('desc'),
});

/**
 * Combined search parameters schema.
 */
export const searchParamsSchema = paginationSchema.merge(sortSchema).extend({
  q: z.string().optional(),
});

/**
 * Date range filter schema.
 */
export const dateRangeSchema = z.object({
  dateFrom: dateTimeSchema.optional(),
  dateTo: dateTimeSchema.optional(),
});

/**
 * Number range filter schema.
 */
export const numberRangeSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
});

/**
 * Hex color code schema.
 */
export const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format (e.g., #FF5733)');

/**
 * Slug schema (URL-friendly identifier).
 */
export const slugSchema = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(50, 'Slug must be at most 50 characters')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase with hyphens only');

/**
 * BigInt string schema (for large numbers).
 */
export const bigIntStringSchema = z.string().regex(/^\d+$/, 'Must be a positive integer');

/**
 * Inferred types from schemas.
 */
export type PaginationInput = z.infer<typeof paginationSchema>;
export type SortInput = z.infer<typeof sortSchema>;
export type SearchParamsInput = z.infer<typeof searchParamsSchema>;
export type DateRangeInput = z.infer<typeof dateRangeSchema>;
export type NumberRangeInput = z.infer<typeof numberRangeSchema>;
