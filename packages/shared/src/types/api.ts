/**
 * API-related type definitions for the Document Management System.
 * @module @dms/shared/types/api
 */

/**
 * HTTP methods supported by the API.
 */
export const HttpMethod = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
  HEAD: 'HEAD',
  OPTIONS: 'OPTIONS',
} as const;

export type HttpMethod = (typeof HttpMethod)[keyof typeof HttpMethod];

/**
 * Sort direction for queries.
 */
export const SortDirection = {
  ASC: 'asc',
  DESC: 'desc',
} as const;

export type SortDirection = (typeof SortDirection)[keyof typeof SortDirection];

/**
 * Standard API error codes.
 */
export const ApiErrorCode = {
  // Client errors (4xx)
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',

  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  GATEWAY_TIMEOUT: 'GATEWAY_TIMEOUT',

  // Domain-specific errors
  STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  ORGANIZATION_LIMIT_REACHED: 'ORGANIZATION_LIMIT_REACHED',
} as const;

export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

/**
 * Successful API response wrapper.
 * @template T - The type of data in the response
 */
export interface ApiResponse<T> {
  /** Indicates the request was successful */
  success: true;
  /** Response data */
  data: T;
  /** Optional metadata */
  meta?: ApiMeta;
}

/**
 * Error API response wrapper.
 */
export interface ApiErrorResponse {
  /** Indicates the request failed */
  success: false;
  /** Error details */
  error: ApiError;
}

/**
 * Unified API response type.
 * @template T - The type of data in successful responses
 */
export type ApiResult<T> = ApiResponse<T> | ApiErrorResponse;

/**
 * API error details.
 */
export interface ApiError {
  /** Machine-readable error code */
  code: ApiErrorCode | string;
  /** Human-readable error message */
  message: string;
  /** Additional error details */
  details?: Record<string, unknown>;
  /** Validation errors by field */
  fieldErrors?: Record<string, string[]>;
  /** Stack trace (only in development) */
  stack?: string;
  /** Request ID for tracking */
  requestId?: string;
}

/**
 * API response metadata.
 */
export interface ApiMeta {
  /** Pagination information */
  pagination?: PaginationMeta;
  /** Response timestamp (ISO 8601) */
  timestamp?: string;
  /** Unique request identifier */
  requestId?: string;
  /** API version */
  apiVersion?: string;
  /** Response time in milliseconds */
  responseTimeMs?: number;
}

/**
 * Pagination metadata for list responses.
 */
export interface PaginationMeta {
  /** Current page number (1-indexed) */
  page: number;
  /** Items per page */
  limit: number;
  /** Total number of items */
  total: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there is a next page */
  hasNext: boolean;
  /** Whether there is a previous page */
  hasPrevious: boolean;
  /** Cursor for next page (if using cursor pagination) */
  nextCursor?: string;
  /** Cursor for previous page (if using cursor pagination) */
  previousCursor?: string;
}

/**
 * Paginated response wrapper.
 * @template T - The type of items in the response
 */
export interface PaginatedResponse<T> {
  /** Indicates the request was successful */
  success: true;
  /** Array of items */
  data: T[];
  /** Pagination and other metadata */
  meta: ApiMeta & { pagination: PaginationMeta };
}

/**
 * Pagination query parameters.
 */
export interface PaginationParams {
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page (max 100) */
  limit?: number;
  /** Cursor for cursor-based pagination */
  cursor?: string;
}

/**
 * Sort query parameters.
 */
export interface SortParams {
  /** Field to sort by */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: SortDirection;
}

/**
 * Combined search parameters.
 */
export interface SearchParams extends PaginationParams, SortParams {
  /** Search query string */
  q?: string;
}

/**
 * Document-specific search parameters.
 */
export interface DocumentSearchParams extends SearchParams {
  /** Filter by folder ID */
  folderId?: string;
  /** Filter by MIME type */
  mimeType?: string;
  /** Filter by document status */
  status?: string;
  /** Filter by creation date (from) */
  dateFrom?: string;
  /** Filter by creation date (to) */
  dateTo?: string;
  /** Filter by file extension */
  extension?: string;
  /** Filter by minimum file size (bytes) */
  minSize?: number;
  /** Filter by maximum file size (bytes) */
  maxSize?: number;
  /** Filter by tags (comma-separated) */
  tags?: string;
  /** Filter by creator user ID */
  createdById?: string;
  /** Include deleted documents */
  includeDeleted?: boolean;
}

/**
 * Semantic search query parameters.
 */
export interface SemanticSearchParams {
  /** Natural language query */
  query: string;
  /** Maximum number of results */
  limit?: number;
  /** Minimum similarity threshold (0-1) */
  threshold?: number;
  /** Filter by folder ID */
  folderId?: string;
  /** Filter by MIME types */
  mimeTypes?: string[];
  /** Include similarity score in results */
  includeScore?: boolean;
}

/**
 * API endpoint definition for documentation.
 */
export interface ApiEndpoint {
  /** HTTP method */
  method: HttpMethod;
  /** URL path pattern */
  path: string;
  /** Endpoint description */
  description: string;
  /** Whether authentication is required */
  auth: boolean;
  /** Required roles (if auth is true) */
  roles?: string[];
  /** Rate limit (requests per minute) */
  rateLimit?: number;
  /** Request body schema reference */
  requestBody?: string;
  /** Response schema reference */
  responseSchema?: string;
}

/**
 * Health check response.
 */
export interface HealthCheckResponse {
  /** Overall service status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Service version */
  version: string;
  /** Uptime in seconds */
  uptime: number;
  /** Individual component health */
  components: {
    /** Database connection status */
    database: ComponentHealth;
    /** Redis connection status */
    redis: ComponentHealth;
    /** S3 connection status */
    storage: ComponentHealth;
    /** Queue connection status */
    queue: ComponentHealth;
  };
  /** Timestamp of health check */
  timestamp: string;
}

/**
 * Individual component health status.
 */
export interface ComponentHealth {
  /** Component status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Response time in milliseconds */
  responseTimeMs?: number;
  /** Error message if unhealthy */
  error?: string;
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Rate limit information returned in headers.
 */
export interface RateLimitInfo {
  /** Maximum requests allowed */
  limit: number;
  /** Remaining requests in current window */
  remaining: number;
  /** Unix timestamp when the limit resets */
  reset: number;
  /** Time window in seconds */
  window: number;
}

/**
 * Webhook event payload.
 */
export interface WebhookEvent<T = unknown> {
  /** Event ID */
  id: string;
  /** Event type */
  type: string;
  /** Event timestamp */
  timestamp: string;
  /** Organization ID */
  organizationId: string;
  /** Event payload */
  data: T;
  /** API version that generated the event */
  apiVersion: string;
}

/**
 * Common webhook event types.
 */
export const WebhookEventType = {
  DOCUMENT_CREATED: 'document.created',
  DOCUMENT_UPDATED: 'document.updated',
  DOCUMENT_DELETED: 'document.deleted',
  DOCUMENT_PROCESSING_COMPLETED: 'document.processing.completed',
  DOCUMENT_PROCESSING_FAILED: 'document.processing.failed',
  FOLDER_CREATED: 'folder.created',
  FOLDER_UPDATED: 'folder.updated',
  FOLDER_DELETED: 'folder.deleted',
  MEMBER_INVITED: 'member.invited',
  MEMBER_JOINED: 'member.joined',
  MEMBER_REMOVED: 'member.removed',
  STORAGE_QUOTA_WARNING: 'storage.quota.warning',
  STORAGE_QUOTA_EXCEEDED: 'storage.quota.exceeded',
} as const;

export type WebhookEventType = (typeof WebhookEventType)[keyof typeof WebhookEventType];

/**
 * Batch request for bulk operations.
 */
export interface BatchRequest<T> {
  /** Array of operations */
  operations: T[];
  /** Whether to stop on first error */
  stopOnError?: boolean;
}

/**
 * Batch response for bulk operations.
 */
export interface BatchResponse<T> {
  /** Total operations processed */
  total: number;
  /** Successful operations count */
  successful: number;
  /** Failed operations count */
  failed: number;
  /** Results for each operation */
  results: Array<{
    /** Operation index */
    index: number;
    /** Whether operation succeeded */
    success: boolean;
    /** Operation result (if successful) */
    data?: T;
    /** Error details (if failed) */
    error?: ApiError;
  }>;
}
