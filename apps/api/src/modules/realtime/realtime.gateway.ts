/**
 * Realtime Gateway
 *
 * WebSocket gateway for real-time communication in the DMS application.
 * Handles:
 * - JWT authentication for socket connections
 * - Room management by organization
 * - Document, folder, and processing events
 * - User presence tracking
 */

import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Logger, UseGuards, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';

import { RealtimeService } from './realtime.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import {
  JoinOrganizationDto,
  LeaveOrganizationDto,
  SubscribeDocumentDto,
  UpdateActivityDto,
  UpdateCursorDto,
  SuccessResponse,
  ErrorResponse,
  RealtimeEventName,
  UserActivityPayload,
  DocumentPresenceUser,
} from './dto/realtime-events.dto';

/**
 * Extended socket interface with user data
 */
interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    email: string;
    name: string | null;
    organizationId?: string;
  };
}

/**
 * JWT payload structure
 */
interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: true, // Configured in adapter
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly usersService: UsersService,
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Called after the gateway is initialized
   */
  afterInit(server: Server): void {
    this.logger.log('WebSocket gateway initialized');

    // Attach server to realtime service for event emission
    this.realtimeService.setServer(server);

    // Set up connection middleware for JWT authentication
    server.use(async (socket, next) => {
      try {
        await this.authenticateSocket(socket as AuthenticatedSocket);
        next();
      } catch (error) {
        this.logger.warn(`Socket authentication failed: ${(error as Error).message}`);
        next(new Error('Authentication failed'));
      }
    });
  }

  /**
   * Authenticate socket connection using JWT from handshake
   */
  private async authenticateSocket(socket: AuthenticatedSocket): Promise<void> {
    // Extract token from handshake auth or query
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
      socket.handshake.query?.token;

    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('No authentication token provided');
    }

    try {
      // Verify JWT token
      const jwtSecret = this.configService.get<string>('JWT_SECRET');
      if (!jwtSecret) {
        throw new Error('JWT_SECRET not configured');
      }

      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: jwtSecret,
      });

      // Get user from database
      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Attach user data to socket
      socket.data = {
        userId: user.id,
        email: user.email,
        name: user.name,
      };

      this.logger.debug(`Socket authenticated: user=${user.email}`);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException(`Invalid token: ${(error as Error).message}`);
    }
  }

  /**
   * Handle new socket connection
   */
  async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    try {
      const { userId, email, name } = socket.data;

      this.logger.log(`Client connected: ${email} (socket: ${socket.id})`);

      // Get user's default organization (first one they belong to)
      const membership = await this.prismaService.organizationMember.findFirst({
        where: { userId },
        include: { organization: true },
      });

      if (membership) {
        socket.data.organizationId = membership.organizationId;

        // Register connection with service
        this.realtimeService.registerConnection(
          socket,
          userId,
          email,
          name,
          membership.organizationId,
        );

        // Emit user joined event
        const connectedUser = {
          id: userId,
          email,
          name,
          socketId: socket.id,
          connectedAt: new Date().toISOString(),
        };
        this.realtimeService.emitUserJoined(connectedUser, membership.organizationId);

        // Send connection success to client
        socket.emit('connected', {
          success: true,
          userId,
          organizationId: membership.organizationId,
          connectedUsers: this.realtimeService.getConnectedUsers(membership.organizationId),
        });
      } else {
        // User has no organization - limited functionality
        socket.emit('connected', {
          success: true,
          userId,
          organizationId: null,
          message: 'No organization membership found',
        });
      }
    } catch (error) {
      this.logger.error(`Connection error: ${(error as Error).message}`);
      socket.emit('error', {
        success: false,
        error: {
          code: 'CONNECTION_ERROR',
          message: 'Failed to establish connection',
        },
      });
      socket.disconnect(true);
    }
  }

  /**
   * Handle socket disconnection
   */
  handleDisconnect(socket: AuthenticatedSocket): void {
    // Clean up document presence first
    this.realtimeService.cleanupSocketPresence(socket.id);

    const connection = this.realtimeService.unregisterConnection(socket.id);

    if (connection) {
      this.logger.log(`Client disconnected: ${connection.email} (socket: ${socket.id})`);

      // Emit user left event (only if user has no other connections)
      if (!this.realtimeService.isUserConnected(connection.userId)) {
        this.realtimeService.emitUserLeft(
          connection.userId,
          connection.email,
          connection.organizationId,
        );
      }
    }
  }

  // ============================================
  // Client-to-Server Event Handlers
  // ============================================

  /**
   * Handle request to join an organization room
   * Allows switching between organizations for multi-org users
   */
  @SubscribeMessage('organization:join')
  async handleJoinOrganization(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: JoinOrganizationDto,
  ): Promise<SuccessResponse | ErrorResponse> {
    try {
      const { userId, email, name } = socket.data;
      const { organizationId } = data;

      // Verify user has access to this organization
      const membership = await this.prismaService.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            userId,
            organizationId,
          },
        },
      });

      if (!membership) {
        return {
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have access to this organization',
          },
        };
      }

      // Leave current organization if different
      const currentOrgId = socket.data.organizationId;
      if (currentOrgId && currentOrgId !== organizationId) {
        this.realtimeService.unregisterConnection(socket.id);
        socket.leave(`org:${currentOrgId}`);

        // Emit leave event for old org
        if (!this.realtimeService.isUserConnected(userId)) {
          this.realtimeService.emitUserLeft(userId, email, currentOrgId);
        }
      }

      // Join new organization
      socket.data.organizationId = organizationId;
      this.realtimeService.registerConnection(
        socket,
        userId,
        email,
        name,
        organizationId,
      );

      // Emit join event
      const connectedUser = {
        id: userId,
        email,
        name,
        socketId: socket.id,
        connectedAt: new Date().toISOString(),
      };
      this.realtimeService.emitUserJoined(connectedUser, organizationId);

      return {
        success: true,
        message: `Joined organization ${organizationId}`,
      };
    } catch (error) {
      this.logger.error(`Error joining organization: ${(error as Error).message}`);
      return {
        success: false,
        error: {
          code: 'JOIN_ERROR',
          message: 'Failed to join organization',
        },
      };
    }
  }

  /**
   * Handle request to leave an organization room
   */
  @SubscribeMessage('organization:leave')
  async handleLeaveOrganization(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: LeaveOrganizationDto,
  ): Promise<SuccessResponse | ErrorResponse> {
    try {
      const { userId, email } = socket.data;
      const { organizationId } = data;

      // Verify this is the user's current organization
      if (socket.data.organizationId !== organizationId) {
        return {
          success: false,
          error: {
            code: 'NOT_IN_ORGANIZATION',
            message: 'You are not in this organization room',
          },
        };
      }

      // Unregister and leave room
      this.realtimeService.unregisterConnection(socket.id);
      socket.leave(`org:${organizationId}`);
      socket.data.organizationId = undefined;

      // Emit leave event
      if (!this.realtimeService.isUserConnected(userId)) {
        this.realtimeService.emitUserLeft(userId, email, organizationId);
      }

      return {
        success: true,
        message: `Left organization ${organizationId}`,
      };
    } catch (error) {
      this.logger.error(`Error leaving organization: ${(error as Error).message}`);
      return {
        success: false,
        error: {
          code: 'LEAVE_ERROR',
          message: 'Failed to leave organization',
        },
      };
    }
  }

  /**
   * Handle request to subscribe to document updates
   */
  @SubscribeMessage('document:subscribe')
  async handleSubscribeDocument(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: SubscribeDocumentDto,
  ): Promise<SuccessResponse | ErrorResponse> {
    try {
      const { userId } = socket.data;
      const { documentId } = data;

      // Verify user has access to this document
      const document = await this.prismaService.document.findFirst({
        where: {
          id: documentId,
          organization: {
            members: {
              some: { userId },
            },
          },
        },
      });

      if (!document) {
        return {
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Document not found or access denied',
          },
        };
      }

      // Subscribe to document room
      this.realtimeService.subscribeToDocument(socket, documentId);

      return {
        success: true,
        message: `Subscribed to document ${documentId}`,
      };
    } catch (error) {
      this.logger.error(`Error subscribing to document: ${(error as Error).message}`);
      return {
        success: false,
        error: {
          code: 'SUBSCRIBE_ERROR',
          message: 'Failed to subscribe to document',
        },
      };
    }
  }

  /**
   * Handle request to unsubscribe from document updates
   */
  @SubscribeMessage('document:unsubscribe')
  async handleUnsubscribeDocument(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: SubscribeDocumentDto,
  ): Promise<SuccessResponse | ErrorResponse> {
    try {
      const { documentId } = data;

      // Unsubscribe from document room
      this.realtimeService.unsubscribeFromDocument(socket, documentId);

      return {
        success: true,
        message: `Unsubscribed from document ${documentId}`,
      };
    } catch (error) {
      this.logger.error(`Error unsubscribing from document: ${(error as Error).message}`);
      return {
        success: false,
        error: {
          code: 'UNSUBSCRIBE_ERROR',
          message: 'Failed to unsubscribe from document',
        },
      };
    }
  }

  /**
   * Handle user activity updates (viewing, editing, idle)
   */
  @SubscribeMessage('activity:update')
  async handleUpdateActivity(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: UpdateActivityDto,
  ): Promise<SuccessResponse | ErrorResponse> {
    try {
      const { userId } = socket.data;
      const organizationId = socket.data.organizationId;

      if (!organizationId) {
        return {
          success: false,
          error: {
            code: 'NOT_IN_ORGANIZATION',
            message: 'Must be in an organization to update activity',
          },
        };
      }

      // Broadcast activity to organization
      const payload: UserActivityPayload = {
        timestamp: new Date().toISOString(),
        organizationId,
        userId,
        activity: data,
      };

      this.realtimeService.emitToOrganization(
        organizationId,
        RealtimeEventName.USER_ACTIVITY,
        payload,
      );

      return {
        success: true,
      };
    } catch (error) {
      this.logger.error(`Error updating activity: ${(error as Error).message}`);
      return {
        success: false,
        error: {
          code: 'ACTIVITY_ERROR',
          message: 'Failed to update activity',
        },
      };
    }
  }

  /**
   * Handle request to get connected users in current organization
   */
  @SubscribeMessage('users:list')
  async handleListUsers(
    @ConnectedSocket() socket: AuthenticatedSocket,
  ): Promise<SuccessResponse & { users?: unknown[] } | ErrorResponse> {
    try {
      const organizationId = socket.data.organizationId;

      if (!organizationId) {
        return {
          success: false,
          error: {
            code: 'NOT_IN_ORGANIZATION',
            message: 'Must be in an organization to list users',
          },
        };
      }

      const users = this.realtimeService.getConnectedUsers(organizationId);

      return {
        success: true,
        users,
      };
    } catch (error) {
      this.logger.error(`Error listing users: ${(error as Error).message}`);
      return {
        success: false,
        error: {
          code: 'LIST_ERROR',
          message: 'Failed to list users',
        },
      };
    }
  }

  /**
   * Handle ping for connection health check
   */
  @SubscribeMessage('ping')
  handlePing(): { event: string; data: number } {
    return {
      event: 'pong',
      data: Date.now(),
    };
  }

  // ============================================
  // Document Presence Handlers
  // ============================================

  /**
   * Handle request to join document presence (show as viewing)
   */
  @SubscribeMessage('presence:join')
  async handlePresenceJoin(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: SubscribeDocumentDto,
  ): Promise<SuccessResponse & { viewers?: DocumentPresenceUser[] } | ErrorResponse> {
    try {
      const { userId } = socket.data;
      const organizationId = socket.data.organizationId;
      const { documentId } = data;

      if (!organizationId) {
        return {
          success: false,
          error: {
            code: 'NOT_IN_ORGANIZATION',
            message: 'Must be in an organization to join presence',
          },
        };
      }

      // Verify user has access to this document
      const document = await this.prismaService.document.findFirst({
        where: {
          id: documentId,
          organization: {
            members: {
              some: { userId },
            },
          },
        },
      });

      if (!document) {
        return {
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Document not found or access denied',
          },
        };
      }

      // Subscribe to document room if not already
      this.realtimeService.subscribeToDocument(socket, documentId);

      // Join presence
      const viewers = this.realtimeService.joinDocumentPresence(
        socket,
        documentId,
        organizationId,
      );

      return {
        success: true,
        viewers,
      };
    } catch (error) {
      this.logger.error(`Error joining presence: ${(error as Error).message}`);
      return {
        success: false,
        error: {
          code: 'PRESENCE_ERROR',
          message: 'Failed to join document presence',
        },
      };
    }
  }

  /**
   * Handle request to leave document presence
   */
  @SubscribeMessage('presence:leave')
  async handlePresenceLeave(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: SubscribeDocumentDto,
  ): Promise<SuccessResponse | ErrorResponse> {
    try {
      const { documentId } = data;

      // Unsubscribe from document (this also removes from presence)
      this.realtimeService.unsubscribeFromDocument(socket, documentId);

      return {
        success: true,
        message: `Left presence for document ${documentId}`,
      };
    } catch (error) {
      this.logger.error(`Error leaving presence: ${(error as Error).message}`);
      return {
        success: false,
        error: {
          code: 'PRESENCE_ERROR',
          message: 'Failed to leave document presence',
        },
      };
    }
  }

  /**
   * Handle cursor position updates
   */
  @SubscribeMessage('presence:cursor')
  async handleCursorUpdate(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: UpdateCursorDto,
  ): Promise<SuccessResponse | ErrorResponse> {
    try {
      const { documentId, position } = data;

      this.realtimeService.updateCursorPosition(socket.id, documentId, position);

      return { success: true };
    } catch (error) {
      this.logger.error(`Error updating cursor: ${(error as Error).message}`);
      return {
        success: false,
        error: {
          code: 'CURSOR_ERROR',
          message: 'Failed to update cursor position',
        },
      };
    }
  }

  /**
   * Handle request to get current document viewers
   */
  @SubscribeMessage('presence:sync')
  async handlePresenceSync(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: SubscribeDocumentDto,
  ): Promise<SuccessResponse & { viewers?: DocumentPresenceUser[] } | ErrorResponse> {
    try {
      const { documentId } = data;

      const viewers = this.realtimeService.getDocumentViewers(documentId);

      return {
        success: true,
        viewers,
      };
    } catch (error) {
      this.logger.error(`Error syncing presence: ${(error as Error).message}`);
      return {
        success: false,
        error: {
          code: 'SYNC_ERROR',
          message: 'Failed to sync presence',
        },
      };
    }
  }
}
