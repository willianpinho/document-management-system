/**
 * Real-time Event DTOs
 *
 * Type definitions for all WebSocket event payloads used in the DMS application.
 * These types ensure type safety between server and client communications.
 */

// ============================================
// Base Types
// ============================================

/**
 * Base event payload with common fields
 */
export interface BaseEventPayload {
  timestamp: string;
  organizationId: string;
}

/**
 * User information included in events
 */
export interface EventUser {
  id: string;
  name: string | null;
  email: string;
}

// ============================================
// Document Events
// ============================================

/**
 * Document data included in events
 */
export interface DocumentEventData {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  processingStatus: string;
  folderId: string | null;
  s3Key: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: EventUser;
}

/**
 * Payload for document:created event
 */
export interface DocumentCreatedPayload extends BaseEventPayload {
  document: DocumentEventData;
  uploadUrl?: string;
  triggeredBy: EventUser;
}

/**
 * Payload for document:updated event
 */
export interface DocumentUpdatedPayload extends BaseEventPayload {
  document: DocumentEventData;
  changes: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
  triggeredBy: EventUser;
}

/**
 * Payload for document:deleted event
 */
export interface DocumentDeletedPayload extends BaseEventPayload {
  documentId: string;
  documentName: string;
  triggeredBy: EventUser;
}

// ============================================
// Folder Events
// ============================================

/**
 * Folder data included in events
 */
export interface FolderEventData {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: EventUser;
}

/**
 * Payload for folder:created event
 */
export interface FolderCreatedPayload extends BaseEventPayload {
  folder: FolderEventData;
  triggeredBy: EventUser;
}

/**
 * Payload for folder:updated event
 */
export interface FolderUpdatedPayload extends BaseEventPayload {
  folder: FolderEventData;
  changes: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
  triggeredBy: EventUser;
}

/**
 * Payload for folder:deleted event
 */
export interface FolderDeletedPayload extends BaseEventPayload {
  folderId: string;
  folderName: string;
  folderPath: string;
  triggeredBy: EventUser;
}

// ============================================
// Processing Events
// ============================================

/**
 * Processing job data included in events
 */
export interface ProcessingJobEventData {
  id: string;
  documentId: string;
  jobType: string;
  status: string;
  progress: number;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

/**
 * Payload for processing:started event
 */
export interface ProcessingStartedPayload extends BaseEventPayload {
  job: ProcessingJobEventData;
  document: {
    id: string;
    name: string;
  };
}

/**
 * Payload for processing:progress event
 */
export interface ProcessingProgressPayload extends BaseEventPayload {
  jobId: string;
  documentId: string;
  progress: number;
  message?: string;
  stage?: string;
}

/**
 * Payload for processing:completed event
 */
export interface ProcessingCompletedPayload extends BaseEventPayload {
  job: ProcessingJobEventData;
  document: {
    id: string;
    name: string;
    processingStatus: string;
  };
  result?: {
    type: string;
    data: unknown;
  };
}

/**
 * Payload for processing:failed event
 */
export interface ProcessingFailedPayload extends BaseEventPayload {
  job: ProcessingJobEventData;
  document: {
    id: string;
    name: string;
  };
  error: {
    message: string;
    code?: string;
    retryable: boolean;
  };
}

// ============================================
// User Presence Events
// ============================================

/**
 * Connected user data
 */
export interface ConnectedUser {
  id: string;
  email: string;
  name: string | null;
  socketId: string;
  connectedAt: string;
  currentLocation?: string;
}

/**
 * Payload for user:joined event
 */
export interface UserJoinedPayload extends BaseEventPayload {
  user: ConnectedUser;
  totalConnected: number;
}

/**
 * Payload for user:left event
 */
export interface UserLeftPayload extends BaseEventPayload {
  userId: string;
  userEmail: string;
  totalConnected: number;
}

/**
 * Payload for user:activity event (optional - for cursor/edit presence)
 */
export interface UserActivityPayload extends BaseEventPayload {
  userId: string;
  activity: {
    type: 'viewing' | 'editing' | 'idle';
    resourceType: 'document' | 'folder';
    resourceId: string;
  };
}

// ============================================
// Document Presence Events
// ============================================

/**
 * Cursor position in a document
 */
export interface CursorPosition {
  page: number;
  x: number;
  y: number;
}

/**
 * User presence in a document
 */
export interface DocumentPresenceUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl?: string | null;
  cursorPosition?: CursorPosition | null;
  color: string;
  lastActiveAt: string;
}

/**
 * Payload for presence:join event (when user starts viewing a document)
 */
export interface PresenceJoinPayload {
  documentId: string;
  user: DocumentPresenceUser;
  viewers: DocumentPresenceUser[];
}

/**
 * Payload for presence:leave event (when user stops viewing a document)
 */
export interface PresenceLeavePayload {
  documentId: string;
  userId: string;
  viewers: DocumentPresenceUser[];
}

/**
 * Payload for presence:cursor event (cursor position update)
 */
export interface PresenceCursorPayload {
  documentId: string;
  userId: string;
  cursorPosition: CursorPosition | null;
}

/**
 * Payload for presence:sync event (full state sync)
 */
export interface PresenceSyncPayload {
  documentId: string;
  viewers: DocumentPresenceUser[];
}

// ============================================
// Event Names
// ============================================

/**
 * All available event names
 */
export enum RealtimeEventName {
  // Document events
  DOCUMENT_CREATED = 'document:created',
  DOCUMENT_UPDATED = 'document:updated',
  DOCUMENT_DELETED = 'document:deleted',

  // Folder events
  FOLDER_CREATED = 'folder:created',
  FOLDER_UPDATED = 'folder:updated',
  FOLDER_DELETED = 'folder:deleted',

  // Processing events
  PROCESSING_STARTED = 'processing:started',
  PROCESSING_PROGRESS = 'processing:progress',
  PROCESSING_COMPLETED = 'processing:completed',
  PROCESSING_FAILED = 'processing:failed',

  // User presence events
  USER_JOINED = 'user:joined',
  USER_LEFT = 'user:left',
  USER_ACTIVITY = 'user:activity',

  // Document presence events
  PRESENCE_JOIN = 'presence:join',
  PRESENCE_LEAVE = 'presence:leave',
  PRESENCE_CURSOR = 'presence:cursor',
  PRESENCE_SYNC = 'presence:sync',

  // System events
  ERROR = 'error',
  RECONNECT = 'reconnect',
}

// ============================================
// Client-to-Server Events
// ============================================

/**
 * Client request to join an organization room
 */
export interface JoinOrganizationDto {
  organizationId: string;
}

/**
 * Client request to leave an organization room
 */
export interface LeaveOrganizationDto {
  organizationId: string;
}

/**
 * Client request to subscribe to document updates
 */
export interface SubscribeDocumentDto {
  documentId: string;
}

/**
 * Client request to update activity status
 */
export interface UpdateActivityDto {
  type: 'viewing' | 'editing' | 'idle';
  resourceType: 'document' | 'folder';
  resourceId: string;
}

/**
 * Client request to update cursor position
 */
export interface UpdateCursorDto {
  documentId: string;
  position: CursorPosition | null;
}

// ============================================
// Server-to-Client Responses
// ============================================

/**
 * Generic success response
 */
export interface SuccessResponse {
  success: true;
  message?: string;
}

/**
 * Error response
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

/**
 * Response type union
 */
export type SocketResponse = SuccessResponse | ErrorResponse;

// ============================================
// Type Guards
// ============================================

export function isSuccessResponse(response: SocketResponse): response is SuccessResponse {
  return response.success === true;
}

export function isErrorResponse(response: SocketResponse): response is ErrorResponse {
  return response.success === false;
}

// ============================================
// Event Payload Type Map
// ============================================

/**
 * Maps event names to their payload types
 */
export interface EventPayloadMap {
  [RealtimeEventName.DOCUMENT_CREATED]: DocumentCreatedPayload;
  [RealtimeEventName.DOCUMENT_UPDATED]: DocumentUpdatedPayload;
  [RealtimeEventName.DOCUMENT_DELETED]: DocumentDeletedPayload;
  [RealtimeEventName.FOLDER_CREATED]: FolderCreatedPayload;
  [RealtimeEventName.FOLDER_UPDATED]: FolderUpdatedPayload;
  [RealtimeEventName.FOLDER_DELETED]: FolderDeletedPayload;
  [RealtimeEventName.PROCESSING_STARTED]: ProcessingStartedPayload;
  [RealtimeEventName.PROCESSING_PROGRESS]: ProcessingProgressPayload;
  [RealtimeEventName.PROCESSING_COMPLETED]: ProcessingCompletedPayload;
  [RealtimeEventName.PROCESSING_FAILED]: ProcessingFailedPayload;
  [RealtimeEventName.USER_JOINED]: UserJoinedPayload;
  [RealtimeEventName.USER_LEFT]: UserLeftPayload;
  [RealtimeEventName.USER_ACTIVITY]: UserActivityPayload;
  [RealtimeEventName.PRESENCE_JOIN]: PresenceJoinPayload;
  [RealtimeEventName.PRESENCE_LEAVE]: PresenceLeavePayload;
  [RealtimeEventName.PRESENCE_CURSOR]: PresenceCursorPayload;
  [RealtimeEventName.PRESENCE_SYNC]: PresenceSyncPayload;
}
