/**
 * Folder-related type definitions for the Document Management System.
 * @module @dms/shared/types/folder
 */

import type { Document } from './document.js';

/**
 * Core folder entity representing a directory in the document hierarchy.
 */
export interface Folder {
  /** Unique identifier (UUID v4) */
  id: string;
  /** Organization ID (tenant) */
  organizationId: string;
  /** Parent folder ID (null for root-level folders) */
  parentId: string | null;
  /** Folder name */
  name: string;
  /** Full path from root (e.g., '/Documents/Reports/2024') */
  path: string;
  /** Folder color for UI (hex color code) */
  color: string | null;
  /** Folder icon identifier */
  icon: string | null;
  /** User ID who created the folder */
  createdById: string;
  /** Timestamp when the folder was created */
  createdAt: Date;
  /** Timestamp when the folder was last updated */
  updatedAt: Date;
}

/**
 * Folder with immediate contents (subfolders and documents).
 */
export interface FolderWithContents extends Folder {
  /** Immediate subfolders */
  subfolders: Folder[];
  /** Documents in this folder */
  documents: Document[];
  /** Total number of documents in this folder (not including subfolders) */
  documentCount: number;
  /** Total size of documents in this folder in bytes */
  totalSizeBytes: bigint;
}

/**
 * Folder with recursive statistics.
 */
export interface FolderWithStats extends Folder {
  /** Total documents including all subfolders */
  totalDocumentCount: number;
  /** Total size including all subfolders in bytes */
  totalSizeBytes: bigint;
  /** Number of immediate subfolders */
  subfolderCount: number;
  /** Depth in the folder hierarchy (0 for root-level) */
  depth: number;
}

/**
 * Hierarchical folder tree structure for navigation.
 */
export interface FolderTree {
  /** Folder ID */
  id: string;
  /** Folder name */
  name: string;
  /** Full path */
  path: string;
  /** Folder color */
  color: string | null;
  /** Folder icon */
  icon: string | null;
  /** Child folders (recursive) */
  children: FolderTree[];
  /** Whether this folder has documents (for lazy loading) */
  hasDocuments: boolean;
  /** Whether this folder has subfolders */
  hasChildren: boolean;
}

/**
 * Breadcrumb item for folder navigation.
 */
export interface BreadcrumbItem {
  /** Folder ID (null for root) */
  id: string | null;
  /** Display name */
  name: string;
  /** Full path */
  path: string;
}

/**
 * Complete breadcrumb trail from root to current folder.
 */
export interface FolderBreadcrumbs {
  /** Ordered list of breadcrumb items from root to current */
  items: BreadcrumbItem[];
  /** Current folder (last item) */
  current: BreadcrumbItem;
}

/**
 * Data transfer object for creating a new folder.
 */
export interface CreateFolderDto {
  /** Folder name */
  name: string;
  /** Parent folder ID (optional, null for root-level) */
  parentId?: string;
  /** Folder color (optional, hex color code) */
  color?: string;
  /** Folder icon identifier (optional) */
  icon?: string;
}

/**
 * Data transfer object for updating an existing folder.
 */
export interface UpdateFolderDto {
  /** Updated folder name */
  name?: string;
  /** Updated color */
  color?: string | null;
  /** Updated icon */
  icon?: string | null;
}

/**
 * Data transfer object for moving a folder to a new parent.
 */
export interface MoveFolderDto {
  /** Target parent folder ID (null for root-level) */
  targetFolderId: string | null;
}

/**
 * Query parameters for folder contents.
 */
export interface FolderContentsQuery {
  /** Folder ID (null for root) */
  folderId?: string;
  /** Include documents in response */
  includeDocuments?: boolean;
  /** Include subfolders in response */
  includeSubfolders?: boolean;
  /** Include folder statistics */
  includeStats?: boolean;
  /** Sort documents by field */
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'sizeBytes';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Folder sharing settings.
 */
export interface FolderSharing {
  /** Folder ID */
  folderId: string;
  /** Whether folder is publicly accessible */
  isPublic: boolean;
  /** Public share link (if public) */
  publicLink: string | null;
  /** Expiration date for public link */
  expiresAt: Date | null;
  /** Password protection for public link */
  isPasswordProtected: boolean;
  /** Allowed actions for public access */
  publicPermissions: ('view' | 'download')[];
}

/**
 * Folder permission for specific users.
 */
export interface FolderPermission {
  /** Permission ID */
  id: string;
  /** Folder ID */
  folderId: string;
  /** User ID */
  userId: string;
  /** Permission level */
  permission: 'view' | 'edit' | 'admin';
  /** Whether permission applies to subfolders */
  recursive: boolean;
  /** When the permission was granted */
  grantedAt: Date;
  /** Who granted the permission */
  grantedById: string;
}

/**
 * Bulk folder operation request.
 */
export interface BulkFolderOperation {
  /** Folder IDs to operate on */
  folderIds: string[];
  /** Operation type */
  operation: 'move' | 'delete';
  /** Target folder ID (for move operation) */
  targetFolderId?: string | null;
}

/**
 * Folder operation result.
 */
export interface FolderOperationResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Affected folder */
  folder?: Folder;
  /** Error message if failed */
  error?: string;
  /** Number of documents affected */
  documentsAffected?: number;
  /** Number of subfolders affected */
  subfoldersAffected?: number;
}
