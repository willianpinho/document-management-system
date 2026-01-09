/**
 * Document-related type definitions for the Document Management System.
 * @module @dms/shared/types/document
 */

/**
 * Document lifecycle status.
 */
export const DocumentStatus = {
  /** Document is being uploaded */
  UPLOADING: 'uploading',
  /** Document upload complete, awaiting processing */
  UPLOADED: 'uploaded',
  /** Document is being processed (OCR, thumbnails, etc.) */
  PROCESSING: 'processing',
  /** Document is ready for use */
  READY: 'ready',
  /** Document processing failed */
  ERROR: 'error',
  /** Document has been soft-deleted */
  DELETED: 'deleted',
} as const;

export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

/**
 * Document processing pipeline status.
 */
export const ProcessingStatus = {
  /** Processing has not started */
  PENDING: 'pending',
  /** OCR is in progress */
  OCR_IN_PROGRESS: 'ocr_in_progress',
  /** OCR completed successfully */
  OCR_COMPLETE: 'ocr_complete',
  /** All processing completed */
  COMPLETE: 'complete',
  /** Processing failed */
  FAILED: 'failed',
} as const;

export type ProcessingStatus = (typeof ProcessingStatus)[keyof typeof ProcessingStatus];

/**
 * Document classification categories.
 */
export const DocumentCategory = {
  INVOICE: 'invoice',
  CONTRACT: 'contract',
  REPORT: 'report',
  LETTER: 'letter',
  IMAGE: 'image',
  SPREADSHEET: 'spreadsheet',
  PRESENTATION: 'presentation',
  LEGAL: 'legal',
  FINANCIAL: 'financial',
  OTHER: 'other',
} as const;

export type DocumentCategory = (typeof DocumentCategory)[keyof typeof DocumentCategory];

/**
 * Bounding box for element positioning within a document.
 */
export interface BoundingBox {
  /** Left position (0-1 normalized) */
  left: number;
  /** Top position (0-1 normalized) */
  top: number;
  /** Width (0-1 normalized) */
  width: number;
  /** Height (0-1 normalized) */
  height: number;
}

/**
 * AI-generated document classification result.
 */
export interface DocumentClassification {
  /** Primary document category */
  category: DocumentCategory;
  /** Classification confidence score (0-1) */
  confidence: number;
  /** Optional subcategory for more specific classification */
  subcategory?: string;
  /** AI model used for classification */
  model?: string;
}

/**
 * Entity extracted from document content via NER or OCR.
 */
export interface ExtractedEntity {
  /** Entity type (e.g., 'PERSON', 'ORGANIZATION', 'DATE', 'AMOUNT') */
  type: string;
  /** Extracted value */
  value: string;
  /** Extraction confidence score (0-1) */
  confidence: number;
  /** Location within the document */
  boundingBox?: BoundingBox;
  /** Page number (1-indexed) */
  pageNumber?: number;
}

/**
 * Document metadata containing extracted and user-provided information.
 */
export interface DocumentMetadata {
  /** User-defined document title */
  title?: string;
  /** User-defined description */
  description?: string;
  /** User-defined tags for organization */
  tags?: string[];
  /** Extracted text content from OCR */
  ocrText?: string;
  /** Total page count (for PDFs) */
  pageCount?: number;
  /** Image/document width in pixels */
  width?: number;
  /** Image/document height in pixels */
  height?: number;
  /** Duration in seconds (for audio/video) */
  duration?: number;
  /** AI-generated classification */
  classification?: DocumentClassification;
  /** Extracted entities (names, dates, amounts, etc.) */
  entities?: ExtractedEntity[];
  /** AI-generated document summary */
  summary?: string;
  /** Original author metadata */
  author?: string;
  /** Document creation date from metadata */
  documentDate?: Date;
  /** Custom key-value metadata */
  custom?: Record<string, string>;
}

/**
 * Core document entity representing a file stored in the system.
 */
export interface Document {
  /** Unique identifier (UUID v4) */
  id: string;
  /** Organization ID (tenant) */
  organizationId: string;
  /** Parent folder ID (null for root) */
  folderId: string | null;
  /** Document file name */
  name: string;
  /** MIME type (e.g., 'application/pdf') */
  mimeType: string;
  /** File size in bytes */
  sizeBytes: bigint;
  /** S3 object key */
  s3Key: string;
  /** S3 version ID (if versioning enabled) */
  s3VersionId: string | null;
  /** File checksum (SHA-256) */
  checksum: string | null;
  /** Current document lifecycle status */
  status: DocumentStatus;
  /** Current processing pipeline status */
  processingStatus: ProcessingStatus;
  /** Document metadata and extracted information */
  metadata: DocumentMetadata;
  /** Content vector embedding for semantic search */
  contentVector?: number[];
  /** User ID who created/uploaded the document */
  createdById: string;
  /** Timestamp when the document was created */
  createdAt: Date;
  /** Timestamp when the document was last updated */
  updatedAt: Date;
  /** Timestamp when the document was deleted (soft delete) */
  deletedAt: Date | null;
}

/**
 * Document version entity for version history tracking.
 */
export interface DocumentVersion {
  /** Unique identifier */
  id: string;
  /** Parent document ID */
  documentId: string;
  /** Version number (1-indexed) */
  versionNumber: number;
  /** S3 object key for this version */
  s3Key: string;
  /** S3 version ID */
  s3VersionId: string | null;
  /** File size in bytes */
  sizeBytes: bigint;
  /** File checksum (SHA-256) */
  checksum: string | null;
  /** Version comment/description */
  comment: string | null;
  /** User ID who created this version */
  createdById: string;
  /** Timestamp when this version was created */
  createdAt: Date;
}

/**
 * Document with version history included.
 */
export interface DocumentWithVersions extends Document {
  /** List of document versions */
  versions: DocumentVersion[];
  /** Current version number */
  currentVersion: number;
}

/**
 * Document with folder information included.
 */
export interface DocumentWithFolder extends Document {
  /** Parent folder details */
  folder: {
    id: string;
    name: string;
    path: string;
  } | null;
}

/**
 * Document with creator information included.
 */
export interface DocumentWithCreator extends Document {
  /** Creator user details */
  createdBy: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
}

/**
 * Full document with all relations populated.
 */
export interface DocumentFull extends DocumentWithVersions, DocumentWithFolder, DocumentWithCreator {}

/**
 * Data transfer object for creating a new document (initiating upload).
 */
export interface CreateDocumentDto {
  /** Document file name */
  name: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Parent folder ID (optional, null for root) */
  folderId?: string;
  /** File checksum for verification (optional) */
  checksum?: string;
}

/**
 * Data transfer object for updating an existing document.
 */
export interface UpdateDocumentDto {
  /** Updated file name */
  name?: string;
  /** Move to different folder (null for root) */
  folderId?: string | null;
  /** Updated metadata */
  metadata?: Partial<Pick<DocumentMetadata, 'title' | 'description' | 'tags' | 'custom'>>;
}

/**
 * Response when creating a document (includes presigned upload URL).
 */
export interface DocumentUploadResponse {
  /** Created document entity */
  document: Document;
  /** Presigned S3 URL for upload */
  uploadUrl: string;
  /** Form fields for multipart upload (if applicable) */
  uploadFields?: Record<string, string>;
  /** Upload URL expiration time in seconds */
  expiresIn: number;
}

/**
 * Response for document download URL request.
 */
export interface DocumentDownloadResponse {
  /** Presigned S3 URL for download */
  url: string;
  /** URL expiration time in seconds */
  expiresIn: number;
  /** Content disposition header value */
  contentDisposition: string;
}

/**
 * Document thumbnail information.
 */
export interface DocumentThumbnail {
  /** Thumbnail URL */
  url: string;
  /** Thumbnail width in pixels */
  width: number;
  /** Thumbnail height in pixels */
  height: number;
  /** Thumbnail format */
  format: 'jpeg' | 'png' | 'webp';
}

/**
 * Document preview information for supported file types.
 */
export interface DocumentPreview {
  /** Preview type */
  type: 'image' | 'pdf' | 'text' | 'unsupported';
  /** Preview URL (if available) */
  url?: string;
  /** Preview HTML content (for text files) */
  content?: string;
  /** Available thumbnails in different sizes */
  thumbnails?: {
    small: DocumentThumbnail;
    medium: DocumentThumbnail;
    large: DocumentThumbnail;
  };
}

/**
 * Bulk document operation request.
 */
export interface BulkDocumentOperation {
  /** Document IDs to operate on */
  documentIds: string[];
  /** Operation type */
  operation: 'move' | 'delete' | 'restore' | 'download';
  /** Target folder ID (for move operation) */
  targetFolderId?: string | null;
}

/**
 * Bulk operation result.
 */
export interface BulkOperationResult {
  /** Number of successful operations */
  successCount: number;
  /** Number of failed operations */
  failedCount: number;
  /** Details of failures */
  failures: Array<{
    documentId: string;
    error: string;
  }>;
}
