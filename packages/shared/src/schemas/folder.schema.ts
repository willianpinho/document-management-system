/**
 * Folder Zod schemas.
 * @module @dms/shared/schemas/folder
 */

import { z } from 'zod';

import { hexColorSchema, sortSchema, uuidSchema } from './common.schema.js';

/**
 * Folder name validation schema.
 * Disallows special characters that could cause path issues.
 */
export const folderNameSchema = z
  .string()
  .min(1, 'Folder name is required')
  .max(255, 'Folder name must be at most 255 characters')
  .regex(/^[^<>:"/\\|?*\x00-\x1f]+$/, 'Invalid characters in folder name')
  .transform((name) => name.trim());

/**
 * Folder icon schema.
 */
export const folderIconSchema = z.string().max(50, 'Icon name too long');

/**
 * Create folder schema.
 */
export const createFolderSchema = z.object({
  name: folderNameSchema,
  parentId: uuidSchema.optional().nullable(),
  color: hexColorSchema.optional().nullable(),
  icon: folderIconSchema.optional().nullable(),
});

/**
 * Update folder schema.
 */
export const updateFolderSchema = z.object({
  name: folderNameSchema.optional(),
  color: hexColorSchema.optional().nullable(),
  icon: folderIconSchema.optional().nullable(),
});

/**
 * Move folder schema.
 */
export const moveFolderSchema = z.object({
  targetFolderId: uuidSchema.nullable(),
});

/**
 * Folder contents query schema.
 */
export const folderContentsSchema = z.object({
  folderId: uuidSchema.optional().nullable(),
  includeDocuments: z.coerce.boolean().default(true),
  includeSubfolders: z.coerce.boolean().default(true),
  includeStats: z.coerce.boolean().default(false),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'sizeBytes']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * Folder tree query schema.
 */
export const folderTreeSchema = z.object({
  rootId: uuidSchema.optional().nullable(),
  maxDepth: z.coerce.number().int().min(1).max(10).default(5),
  includeDocumentCount: z.coerce.boolean().default(false),
});

/**
 * Folder path query schema (for breadcrumbs).
 */
export const folderPathSchema = z.object({
  folderId: uuidSchema,
});

/**
 * Bulk folder operation schema.
 */
export const bulkFolderOperationSchema = z.object({
  folderIds: z.array(uuidSchema).min(1, 'At least one folder required').max(50, 'Maximum 50 folders'),
  operation: z.enum(['move', 'delete']),
  targetFolderId: uuidSchema.optional().nullable(),
});

/**
 * Folder sharing schema.
 */
export const folderSharingSchema = z.object({
  isPublic: z.boolean(),
  expiresAt: z.string().datetime().optional().nullable(),
  password: z.string().min(6).max(128).optional().nullable(),
  permissions: z.array(z.enum(['view', 'download'])).default(['view']),
});

/**
 * Folder permission schema.
 */
export const folderPermissionSchema = z.object({
  userId: uuidSchema,
  permission: z.enum(['view', 'edit', 'admin']),
  recursive: z.boolean().default(true),
});

/**
 * Inferred types from schemas.
 */
export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;
export type MoveFolderInput = z.infer<typeof moveFolderSchema>;
export type FolderContentsInput = z.infer<typeof folderContentsSchema>;
export type FolderTreeInput = z.infer<typeof folderTreeSchema>;
export type FolderPathInput = z.infer<typeof folderPathSchema>;
export type BulkFolderOperationInput = z.infer<typeof bulkFolderOperationSchema>;
export type FolderSharingInput = z.infer<typeof folderSharingSchema>;
export type FolderPermissionInput = z.infer<typeof folderPermissionSchema>;
