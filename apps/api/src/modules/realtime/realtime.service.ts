/**
 * Realtime Service
 *
 * Provides methods to emit real-time events to connected clients.
 * Handles room management, user presence, and event broadcasting.
 *
 * Events are broadcast via Socket.io rooms:
 * - org:{orgId} - All users in an organization
 * - user:{userId} - Specific user across all their connections
 * - doc:{docId} - Users viewing a specific document
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

import {
  RealtimeEventName,
  DocumentCreatedPayload,
  DocumentUpdatedPayload,
  DocumentDeletedPayload,
  FolderCreatedPayload,
  FolderUpdatedPayload,
  FolderDeletedPayload,
  ProcessingStartedPayload,
  ProcessingProgressPayload,
  ProcessingCompletedPayload,
  ProcessingFailedPayload,
  UserJoinedPayload,
  UserLeftPayload,
  ConnectedUser,
  EventUser,
  DocumentEventData,
  FolderEventData,
  ProcessingJobEventData,
} from './dto/realtime-events.dto';

/**
 * In-memory store for connected users
 * In production, consider using Redis for persistence across instances
 */
interface UserConnection {
  userId: string;
  email: string;
  name: string | null;
  socketId: string;
  organizationId: string;
  connectedAt: Date;
  currentLocation?: string;
}

@Injectable()
export class RealtimeService implements OnModuleInit {
  private readonly logger = new Logger(RealtimeService.name);

  /**
   * Socket.io server instance (injected by gateway)
   */
  private server: Server | null = null;

  /**
   * Map of socket ID to user connection info
   */
  private readonly connections = new Map<string, UserConnection>();

  /**
   * Map of user ID to set of socket IDs (user can have multiple connections)
   */
  private readonly userSockets = new Map<string, Set<string>>();

  /**
   * Map of organization ID to set of user IDs
   */
  private readonly organizationUsers = new Map<string, Set<string>>();

  onModuleInit() {
    this.logger.log('RealtimeService initialized');
  }

  /**
   * Set the Socket.io server instance
   * Called by the gateway after initialization
   */
  setServer(server: Server): void {
    this.server = server;
    this.logger.log('Socket.io server attached to RealtimeService');
  }

  /**
   * Get the Socket.io server instance
   */
  getServer(): Server | null {
    return this.server;
  }

  // ============================================
  // Connection Management
  // ============================================

  /**
   * Register a new connection
   */
  registerConnection(
    socket: Socket,
    userId: string,
    email: string,
    name: string | null,
    organizationId: string,
  ): void {
    const connection: UserConnection = {
      userId,
      email,
      name,
      socketId: socket.id,
      organizationId,
      connectedAt: new Date(),
    };

    // Store connection
    this.connections.set(socket.id, connection);

    // Track user's sockets
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socket.id);

    // Track organization users
    if (!this.organizationUsers.has(organizationId)) {
      this.organizationUsers.set(organizationId, new Set());
    }
    this.organizationUsers.get(organizationId)!.add(userId);

    // Join organization room
    const orgRoom = this.getOrganizationRoom(organizationId);
    socket.join(orgRoom);

    // Join user-specific room (for direct messages)
    const userRoom = this.getUserRoom(userId);
    socket.join(userRoom);

    this.logger.log(
      `User ${email} connected: socket=${socket.id}, org=${organizationId}`,
    );
  }

  /**
   * Unregister a connection
   */
  unregisterConnection(socketId: string): UserConnection | null {
    const connection = this.connections.get(socketId);
    if (!connection) {
      return null;
    }

    // Remove from connections map
    this.connections.delete(socketId);

    // Remove from user's sockets
    const userSocketSet = this.userSockets.get(connection.userId);
    if (userSocketSet) {
      userSocketSet.delete(socketId);
      if (userSocketSet.size === 0) {
        this.userSockets.delete(connection.userId);

        // Remove user from organization if no more connections
        const orgUserSet = this.organizationUsers.get(connection.organizationId);
        if (orgUserSet) {
          orgUserSet.delete(connection.userId);
          if (orgUserSet.size === 0) {
            this.organizationUsers.delete(connection.organizationId);
          }
        }
      }
    }

    this.logger.log(
      `User ${connection.email} disconnected: socket=${socketId}`,
    );

    return connection;
  }

  /**
   * Get connection info by socket ID
   */
  getConnection(socketId: string): UserConnection | null {
    return this.connections.get(socketId) || null;
  }

  /**
   * Get all connected users in an organization
   */
  getConnectedUsers(organizationId: string): ConnectedUser[] {
    const userIds = this.organizationUsers.get(organizationId);
    if (!userIds) {
      return [];
    }

    const users: ConnectedUser[] = [];
    for (const userId of userIds) {
      const socketIds = this.userSockets.get(userId);
      if (socketIds && socketIds.size > 0) {
        // Get the first socket for this user (they're all the same user)
        const socketId = socketIds.values().next().value;
        const connection = this.connections.get(socketId);
        if (connection) {
          users.push({
            id: connection.userId,
            email: connection.email,
            name: connection.name,
            socketId: connection.socketId,
            connectedAt: connection.connectedAt.toISOString(),
            currentLocation: connection.currentLocation,
          });
        }
      }
    }

    return users;
  }

  /**
   * Get count of connected users in an organization
   */
  getConnectedUserCount(organizationId: string): number {
    const userIds = this.organizationUsers.get(organizationId);
    return userIds?.size || 0;
  }

  /**
   * Check if a user is connected
   */
  isUserConnected(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return sockets !== undefined && sockets.size > 0;
  }

  // ============================================
  // Room Helpers
  // ============================================

  private getOrganizationRoom(organizationId: string): string {
    return `org:${organizationId}`;
  }

  private getUserRoom(userId: string): string {
    return `user:${userId}`;
  }

  private getDocumentRoom(documentId: string): string {
    return `doc:${documentId}`;
  }

  // ============================================
  // Event Emission Methods
  // ============================================

  /**
   * Emit an event to all users in an organization
   */
  emitToOrganization<T>(
    organizationId: string,
    event: RealtimeEventName | string,
    data: T,
  ): void {
    if (!this.server) {
      this.logger.warn('Cannot emit: Socket.io server not initialized');
      return;
    }

    const room = this.getOrganizationRoom(organizationId);
    this.server.to(room).emit(event, data);

    this.logger.debug(
      `Emitted ${event} to org:${organizationId} (${this.getConnectedUserCount(organizationId)} users)`,
    );
  }

  /**
   * Emit an event to a specific user (all their connections)
   */
  emitToUser<T>(userId: string, event: RealtimeEventName | string, data: T): void {
    if (!this.server) {
      this.logger.warn('Cannot emit: Socket.io server not initialized');
      return;
    }

    const room = this.getUserRoom(userId);
    this.server.to(room).emit(event, data);

    this.logger.debug(`Emitted ${event} to user:${userId}`);
  }

  /**
   * Emit an event to users viewing a specific document
   */
  emitToDocument<T>(
    documentId: string,
    event: RealtimeEventName | string,
    data: T,
  ): void {
    if (!this.server) {
      this.logger.warn('Cannot emit: Socket.io server not initialized');
      return;
    }

    const room = this.getDocumentRoom(documentId);
    this.server.to(room).emit(event, data);

    this.logger.debug(`Emitted ${event} to doc:${documentId}`);
  }

  // ============================================
  // Document Event Methods
  // ============================================

  /**
   * Emit a document created event
   */
  emitDocumentCreated(
    document: DocumentEventData,
    organizationId: string,
    triggeredBy: EventUser,
    uploadUrl?: string,
  ): void {
    const payload: DocumentCreatedPayload = {
      timestamp: new Date().toISOString(),
      organizationId,
      document,
      triggeredBy,
      uploadUrl,
    };

    this.emitToOrganization(
      organizationId,
      RealtimeEventName.DOCUMENT_CREATED,
      payload,
    );
  }

  /**
   * Emit a document updated event
   */
  emitDocumentUpdated(
    document: DocumentEventData,
    organizationId: string,
    triggeredBy: EventUser,
    changes: { field: string; oldValue: unknown; newValue: unknown }[],
  ): void {
    const payload: DocumentUpdatedPayload = {
      timestamp: new Date().toISOString(),
      organizationId,
      document,
      changes,
      triggeredBy,
    };

    this.emitToOrganization(
      organizationId,
      RealtimeEventName.DOCUMENT_UPDATED,
      payload,
    );

    // Also emit to document-specific room
    this.emitToDocument(
      document.id,
      RealtimeEventName.DOCUMENT_UPDATED,
      payload,
    );
  }

  /**
   * Emit a document deleted event
   */
  emitDocumentDeleted(
    documentId: string,
    documentName: string,
    organizationId: string,
    triggeredBy: EventUser,
  ): void {
    const payload: DocumentDeletedPayload = {
      timestamp: new Date().toISOString(),
      organizationId,
      documentId,
      documentName,
      triggeredBy,
    };

    this.emitToOrganization(
      organizationId,
      RealtimeEventName.DOCUMENT_DELETED,
      payload,
    );

    // Also emit to document-specific room
    this.emitToDocument(documentId, RealtimeEventName.DOCUMENT_DELETED, payload);
  }

  /**
   * Convenience method for emitting document events
   */
  emitDocumentEvent(
    eventType: 'created' | 'updated' | 'deleted',
    document: DocumentEventData | { id: string; name: string },
    organizationId: string,
    triggeredBy: EventUser,
    options?: {
      changes?: { field: string; oldValue: unknown; newValue: unknown }[];
      uploadUrl?: string;
    },
  ): void {
    switch (eventType) {
      case 'created':
        this.emitDocumentCreated(
          document as DocumentEventData,
          organizationId,
          triggeredBy,
          options?.uploadUrl,
        );
        break;
      case 'updated':
        this.emitDocumentUpdated(
          document as DocumentEventData,
          organizationId,
          triggeredBy,
          options?.changes || [],
        );
        break;
      case 'deleted':
        this.emitDocumentDeleted(
          document.id,
          document.name,
          organizationId,
          triggeredBy,
        );
        break;
    }
  }

  // ============================================
  // Folder Event Methods
  // ============================================

  /**
   * Emit a folder created event
   */
  emitFolderCreated(
    folder: FolderEventData,
    organizationId: string,
    triggeredBy: EventUser,
  ): void {
    const payload: FolderCreatedPayload = {
      timestamp: new Date().toISOString(),
      organizationId,
      folder,
      triggeredBy,
    };

    this.emitToOrganization(
      organizationId,
      RealtimeEventName.FOLDER_CREATED,
      payload,
    );
  }

  /**
   * Emit a folder updated event
   */
  emitFolderUpdated(
    folder: FolderEventData,
    organizationId: string,
    triggeredBy: EventUser,
    changes: { field: string; oldValue: unknown; newValue: unknown }[],
  ): void {
    const payload: FolderUpdatedPayload = {
      timestamp: new Date().toISOString(),
      organizationId,
      folder,
      changes,
      triggeredBy,
    };

    this.emitToOrganization(
      organizationId,
      RealtimeEventName.FOLDER_UPDATED,
      payload,
    );
  }

  /**
   * Emit a folder deleted event
   */
  emitFolderDeleted(
    folderId: string,
    folderName: string,
    folderPath: string,
    organizationId: string,
    triggeredBy: EventUser,
  ): void {
    const payload: FolderDeletedPayload = {
      timestamp: new Date().toISOString(),
      organizationId,
      folderId,
      folderName,
      folderPath,
      triggeredBy,
    };

    this.emitToOrganization(
      organizationId,
      RealtimeEventName.FOLDER_DELETED,
      payload,
    );
  }

  /**
   * Convenience method for emitting folder events
   */
  emitFolderEvent(
    eventType: 'created' | 'updated' | 'deleted',
    folder: FolderEventData | { id: string; name: string; path: string },
    organizationId: string,
    triggeredBy: EventUser,
    changes?: { field: string; oldValue: unknown; newValue: unknown }[],
  ): void {
    switch (eventType) {
      case 'created':
        this.emitFolderCreated(
          folder as FolderEventData,
          organizationId,
          triggeredBy,
        );
        break;
      case 'updated':
        this.emitFolderUpdated(
          folder as FolderEventData,
          organizationId,
          triggeredBy,
          changes || [],
        );
        break;
      case 'deleted':
        this.emitFolderDeleted(
          folder.id,
          folder.name,
          folder.path,
          organizationId,
          triggeredBy,
        );
        break;
    }
  }

  // ============================================
  // Processing Event Methods
  // ============================================

  /**
   * Emit a processing started event
   */
  emitProcessingStarted(
    job: ProcessingJobEventData,
    document: { id: string; name: string },
    organizationId: string,
  ): void {
    const payload: ProcessingStartedPayload = {
      timestamp: new Date().toISOString(),
      organizationId,
      job,
      document,
    };

    this.emitToOrganization(
      organizationId,
      RealtimeEventName.PROCESSING_STARTED,
      payload,
    );

    // Also emit to document-specific room
    this.emitToDocument(
      document.id,
      RealtimeEventName.PROCESSING_STARTED,
      payload,
    );
  }

  /**
   * Emit a processing progress event
   */
  emitProcessingProgress(
    jobId: string,
    documentId: string,
    organizationId: string,
    progress: number,
    message?: string,
    stage?: string,
  ): void {
    const payload: ProcessingProgressPayload = {
      timestamp: new Date().toISOString(),
      organizationId,
      jobId,
      documentId,
      progress,
      message,
      stage,
    };

    this.emitToOrganization(
      organizationId,
      RealtimeEventName.PROCESSING_PROGRESS,
      payload,
    );

    // Also emit to document-specific room
    this.emitToDocument(
      documentId,
      RealtimeEventName.PROCESSING_PROGRESS,
      payload,
    );
  }

  /**
   * Emit a processing completed event
   */
  emitProcessingCompleted(
    job: ProcessingJobEventData,
    document: { id: string; name: string; processingStatus: string },
    organizationId: string,
    result?: { type: string; data: unknown },
  ): void {
    const payload: ProcessingCompletedPayload = {
      timestamp: new Date().toISOString(),
      organizationId,
      job,
      document,
      result,
    };

    this.emitToOrganization(
      organizationId,
      RealtimeEventName.PROCESSING_COMPLETED,
      payload,
    );

    // Also emit to document-specific room
    this.emitToDocument(
      document.id,
      RealtimeEventName.PROCESSING_COMPLETED,
      payload,
    );
  }

  /**
   * Emit a processing failed event
   */
  emitProcessingFailed(
    job: ProcessingJobEventData,
    document: { id: string; name: string },
    organizationId: string,
    error: { message: string; code?: string; retryable: boolean },
  ): void {
    const payload: ProcessingFailedPayload = {
      timestamp: new Date().toISOString(),
      organizationId,
      job,
      document,
      error,
    };

    this.emitToOrganization(
      organizationId,
      RealtimeEventName.PROCESSING_FAILED,
      payload,
    );

    // Also emit to document-specific room
    this.emitToDocument(
      document.id,
      RealtimeEventName.PROCESSING_FAILED,
      payload,
    );
  }

  /**
   * Convenience method for emitting processing events
   */
  emitProcessingEvent(
    eventType: 'started' | 'progress' | 'completed' | 'failed',
    job: ProcessingJobEventData,
    document: { id: string; name: string; processingStatus?: string },
    organizationId: string,
    options?: {
      progress?: number;
      message?: string;
      stage?: string;
      result?: { type: string; data: unknown };
      error?: { message: string; code?: string; retryable: boolean };
    },
  ): void {
    switch (eventType) {
      case 'started':
        this.emitProcessingStarted(job, document, organizationId);
        break;
      case 'progress':
        this.emitProcessingProgress(
          job.id,
          document.id,
          organizationId,
          options?.progress ?? job.progress,
          options?.message,
          options?.stage,
        );
        break;
      case 'completed':
        this.emitProcessingCompleted(
          job,
          { ...document, processingStatus: document.processingStatus ?? 'completed' },
          organizationId,
          options?.result,
        );
        break;
      case 'failed':
        this.emitProcessingFailed(
          job,
          document,
          organizationId,
          options?.error ?? { message: 'Unknown error', retryable: false },
        );
        break;
    }
  }

  // ============================================
  // User Presence Event Methods
  // ============================================

  /**
   * Emit a user joined event
   */
  emitUserJoined(user: ConnectedUser, organizationId: string): void {
    const payload: UserJoinedPayload = {
      timestamp: new Date().toISOString(),
      organizationId,
      user,
      totalConnected: this.getConnectedUserCount(organizationId),
    };

    this.emitToOrganization(
      organizationId,
      RealtimeEventName.USER_JOINED,
      payload,
    );
  }

  /**
   * Emit a user left event
   */
  emitUserLeft(
    userId: string,
    userEmail: string,
    organizationId: string,
  ): void {
    const payload: UserLeftPayload = {
      timestamp: new Date().toISOString(),
      organizationId,
      userId,
      userEmail,
      totalConnected: this.getConnectedUserCount(organizationId),
    };

    this.emitToOrganization(
      organizationId,
      RealtimeEventName.USER_LEFT,
      payload,
    );
  }

  // ============================================
  // Document Room Management
  // ============================================

  /**
   * Subscribe a socket to a document room
   */
  subscribeToDocument(socket: Socket, documentId: string): void {
    const room = this.getDocumentRoom(documentId);
    socket.join(room);

    const connection = this.connections.get(socket.id);
    if (connection) {
      connection.currentLocation = `document:${documentId}`;
    }

    this.logger.debug(`Socket ${socket.id} subscribed to doc:${documentId}`);
  }

  /**
   * Unsubscribe a socket from a document room
   */
  unsubscribeFromDocument(socket: Socket, documentId: string): void {
    const room = this.getDocumentRoom(documentId);
    socket.leave(room);

    const connection = this.connections.get(socket.id);
    if (connection && connection.currentLocation === `document:${documentId}`) {
      connection.currentLocation = undefined;
    }

    this.logger.debug(`Socket ${socket.id} unsubscribed from doc:${documentId}`);
  }

  // ============================================
  // Statistics
  // ============================================

  /**
   * Get statistics about current connections
   */
  getStats(): {
    totalConnections: number;
    totalUsers: number;
    totalOrganizations: number;
    connectionsByOrganization: Record<string, number>;
  } {
    const connectionsByOrganization: Record<string, number> = {};
    for (const [orgId, userSet] of this.organizationUsers) {
      connectionsByOrganization[orgId] = userSet.size;
    }

    return {
      totalConnections: this.connections.size,
      totalUsers: this.userSockets.size,
      totalOrganizations: this.organizationUsers.size,
      connectionsByOrganization,
    };
  }
}
