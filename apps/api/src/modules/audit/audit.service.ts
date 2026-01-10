import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '@/common/prisma/prisma.service';
import {
  AuditAction,
  AuditResourceType,
  AuditContext,
  AuditLogQueryDto,
  AuditExportFormat,
  AuditLogDto,
  AuditLogListDto,
  ResourceHistoryDto,
  UserActivityDto,
  AuditExportDto,
  ChangeMetadata,
} from './dto/audit.dto';

/**
 * Mapping from our DTO enums to Prisma enums
 * This handles the translation between frontend-friendly names and database values
 */
const ACTION_TO_PRISMA: Record<AuditAction, string> = {
  // Auth actions
  [AuditAction.LOGIN]: 'USER_LOGIN',
  [AuditAction.LOGOUT]: 'USER_LOGOUT',
  [AuditAction.TOKEN_REFRESH]: 'USER_LOGIN', // Map to closest
  [AuditAction.PASSWORD_CHANGE]: 'SETTINGS_UPDATED',
  [AuditAction.PASSWORD_RESET]: 'SETTINGS_UPDATED',
  [AuditAction.PASSWORD_RESET_REQUEST]: 'SETTINGS_UPDATED',
  [AuditAction.REGISTER]: 'USER_REGISTERED',
  [AuditAction.SESSION_REVOKED]: 'USER_LOGOUT',
  [AuditAction.SESSIONS_REVOKED_ALL]: 'USER_LOGOUT',

  // User account actions
  [AuditAction.DATA_EXPORT]: 'SETTINGS_UPDATED',
  [AuditAction.ACCOUNT_DELETE]: 'SETTINGS_UPDATED',

  // Document actions
  [AuditAction.DOCUMENT_CREATE]: 'DOCUMENT_CREATED',
  [AuditAction.DOCUMENT_READ]: 'DOCUMENT_VIEWED',
  [AuditAction.DOCUMENT_UPDATE]: 'DOCUMENT_UPDATED',
  [AuditAction.DOCUMENT_DELETE]: 'DOCUMENT_DELETED',
  [AuditAction.DOCUMENT_DOWNLOAD]: 'DOCUMENT_DOWNLOADED',
  [AuditAction.DOCUMENT_UPLOAD]: 'DOCUMENT_CREATED',
  [AuditAction.DOCUMENT_PROCESS]: 'PROCESSING_STARTED',
  [AuditAction.DOCUMENT_SHARE]: 'DOCUMENT_COPIED',
  [AuditAction.DOCUMENT_MOVE]: 'DOCUMENT_MOVED',
  [AuditAction.DOCUMENT_COPY]: 'DOCUMENT_COPIED',
  [AuditAction.DOCUMENT_RESTORE]: 'DOCUMENT_RESTORED',

  // Folder actions
  [AuditAction.FOLDER_CREATE]: 'FOLDER_CREATED',
  [AuditAction.FOLDER_READ]: 'FOLDER_CREATED', // No direct mapping
  [AuditAction.FOLDER_UPDATE]: 'FOLDER_UPDATED',
  [AuditAction.FOLDER_DELETE]: 'FOLDER_DELETED',
  [AuditAction.FOLDER_SHARE]: 'FOLDER_UPDATED',
  [AuditAction.FOLDER_UNSHARE]: 'FOLDER_UPDATED',
  [AuditAction.FOLDER_MOVE]: 'FOLDER_MOVED',

  // Organization actions
  [AuditAction.ORGANIZATION_CREATE]: 'ORGANIZATION_CREATED',
  [AuditAction.ORGANIZATION_UPDATE]: 'ORGANIZATION_UPDATED',
  [AuditAction.ORGANIZATION_DELETE]: 'ORGANIZATION_UPDATED',
  [AuditAction.MEMBER_INVITE]: 'MEMBER_INVITED',
  [AuditAction.MEMBER_REMOVE]: 'MEMBER_REMOVED',
  [AuditAction.MEMBER_ROLE_CHANGE]: 'MEMBER_ROLE_CHANGED',
  [AuditAction.MEMBER_JOIN]: 'MEMBER_INVITED',
  [AuditAction.MEMBER_LEAVE]: 'MEMBER_REMOVED',

  // Settings actions
  [AuditAction.SETTINGS_UPDATE]: 'SETTINGS_UPDATED',
  [AuditAction.API_KEY_CREATE]: 'API_KEY_CREATED',
  [AuditAction.API_KEY_REVOKE]: 'API_KEY_REVOKED',

  // Processing actions
  [AuditAction.PROCESSING_START]: 'PROCESSING_STARTED',
  [AuditAction.PROCESSING_COMPLETE]: 'PROCESSING_COMPLETED',
  [AuditAction.PROCESSING_FAIL]: 'PROCESSING_FAILED',

  // Search actions
  [AuditAction.SEARCH_EXECUTE]: 'DOCUMENT_VIEWED',
};

const RESOURCE_TYPE_TO_PRISMA: Record<AuditResourceType, string> = {
  [AuditResourceType.USER]: 'USER',
  [AuditResourceType.ORGANIZATION]: 'ORGANIZATION',
  [AuditResourceType.FOLDER]: 'FOLDER',
  [AuditResourceType.DOCUMENT]: 'DOCUMENT',
  [AuditResourceType.DOCUMENT_VERSION]: 'DOCUMENT_VERSION',
  [AuditResourceType.PROCESSING_JOB]: 'PROCESSING_JOB',
  [AuditResourceType.API_KEY]: 'API_KEY',
  [AuditResourceType.SETTINGS]: 'USER', // Map settings to user
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an audit event
   */
  async log(
    action: AuditAction,
    resourceType: AuditResourceType,
    resourceId: string | null,
    metadata: Record<string, unknown> | null,
    context: AuditContext,
  ): Promise<void> {
    try {
      const prismaAction = ACTION_TO_PRISMA[action] || action;
      const prismaResourceType = RESOURCE_TYPE_TO_PRISMA[resourceType] || resourceType;

      await this.prisma.auditLog.create({
        data: {
          organizationId: context.organizationId,
          userId: context.userId || null,
          action: prismaAction as any,
          resourceType: prismaResourceType as any,
          resourceId: resourceId || null,
          metadata: (metadata || {}) as any,
          ipAddress: context.ipAddress || null,
          userAgent: context.userAgent || null,
        },
      });

      this.logger.debug(
        `Audit log created: ${action} on ${resourceType}${resourceId ? `/${resourceId}` : ''} by user ${context.userId || 'anonymous'}`,
      );
    } catch (error) {
      // Log error but don't throw - audit logging should not break the main flow
      this.logger.error(`Failed to create audit log: ${error}`, {
        action,
        resourceType,
        resourceId,
        context,
      });
    }
  }

  /**
   * Log an audit event with change tracking
   */
  async logWithChanges(
    action: AuditAction,
    resourceType: AuditResourceType,
    resourceId: string | null,
    changes: ChangeMetadata,
    context: AuditContext,
  ): Promise<void> {
    const metadata: Record<string, unknown> = {
      ...changes,
      timestamp: new Date().toISOString(),
    };

    await this.log(action, resourceType, resourceId, metadata, context);
  }

  /**
   * Get audit logs with filtering and pagination
   */
  async getAuditLogs(
    organizationId: string,
    filters: AuditLogQueryDto,
  ): Promise<AuditLogListDto> {
    const {
      page = 1,
      limit = 20,
      action,
      resourceType,
      resourceId,
      userId,
      startDate,
      endDate,
      ipAddress,
    } = filters;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.AuditLogWhereInput = {
      organizationId,
      ...(action && { action: ACTION_TO_PRISMA[action] as any }),
      ...(resourceType && { resourceType: RESOURCE_TYPE_TO_PRISMA[resourceType] as any }),
      ...(resourceId && { resourceId }),
      ...(userId && { userId }),
      ...(ipAddress && { ipAddress }),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const data: AuditLogDto[] = logs.map((log) => ({
      id: log.id,
      organizationId: log.organizationId,
      user: log.user
        ? {
            id: log.user.id,
            name: log.user.name || undefined,
            email: log.user.email,
          }
        : undefined,
      action: this.prismaActionToDto(log.action),
      resourceType: this.prismaResourceTypeToDto(log.resourceType),
      resourceId: log.resourceId || undefined,
      metadata: log.metadata as Record<string, unknown>,
      ipAddress: log.ipAddress || undefined,
      userAgent: log.userAgent || undefined,
      createdAt: log.createdAt,
    }));

    return {
      data,
      meta: {
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrevious: page > 1,
        },
      },
    };
  }

  /**
   * Get history for a specific resource
   */
  async getResourceHistory(
    organizationId: string,
    resourceType: AuditResourceType,
    resourceId: string,
  ): Promise<ResourceHistoryDto> {
    const prismaResourceType = RESOURCE_TYPE_TO_PRISMA[resourceType];

    const logs = await this.prisma.auditLog.findMany({
      where: {
        organizationId,
        resourceType: prismaResourceType as any,
        resourceId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const history: AuditLogDto[] = logs.map((log) => ({
      id: log.id,
      organizationId: log.organizationId,
      user: log.user
        ? {
            id: log.user.id,
            name: log.user.name || undefined,
            email: log.user.email,
          }
        : undefined,
      action: this.prismaActionToDto(log.action),
      resourceType: this.prismaResourceTypeToDto(log.resourceType),
      resourceId: log.resourceId || undefined,
      metadata: log.metadata as Record<string, unknown>,
      ipAddress: log.ipAddress || undefined,
      userAgent: log.userAgent || undefined,
      createdAt: log.createdAt,
    }));

    return {
      resourceType,
      resourceId,
      history,
      totalActions: logs.length,
    };
  }

  /**
   * Get activity for a specific user within a date range
   */
  async getUserActivity(
    organizationId: string,
    userId: string,
    startDate: Date,
    endDate: Date,
    page: number = 1,
    limit: number = 50,
  ): Promise<UserActivityDto> {
    const skip = (page - 1) * limit;

    const [logs, user, actionCounts] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: {
          organizationId,
          userId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true },
      }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where: {
          organizationId,
          userId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: true,
      }),
    ]);

    const activities: AuditLogDto[] = logs.map((log) => ({
      id: log.id,
      organizationId: log.organizationId,
      action: this.prismaActionToDto(log.action),
      resourceType: this.prismaResourceTypeToDto(log.resourceType),
      resourceId: log.resourceId || undefined,
      metadata: log.metadata as Record<string, unknown>,
      ipAddress: log.ipAddress || undefined,
      userAgent: log.userAgent || undefined,
      createdAt: log.createdAt,
    }));

    const summary: Record<string, number> = {};
    let totalActivities = 0;
    for (const count of actionCounts) {
      const actionName = this.prismaActionToDto(count.action);
      summary[actionName] = count._count;
      totalActivities += count._count;
    }

    return {
      user: user
        ? {
            id: user.id,
            name: user.name || undefined,
            email: user.email,
          }
        : { id: userId },
      activities,
      summary,
      totalActivities,
    };
  }

  /**
   * Export audit logs in specified format
   */
  async exportLogs(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    format: AuditExportFormat,
    filters?: {
      action?: AuditAction;
      resourceType?: AuditResourceType;
      userId?: string;
    },
  ): Promise<AuditExportDto> {
    const where: Prisma.AuditLogWhereInput = {
      organizationId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      ...(filters?.action && { action: ACTION_TO_PRISMA[filters.action] as any }),
      ...(filters?.resourceType && {
        resourceType: RESOURCE_TYPE_TO_PRISMA[filters.resourceType] as any,
      }),
      ...(filters?.userId && { userId: filters.userId }),
    };

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const exportData = logs.map((log) => ({
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      action: this.prismaActionToDto(log.action),
      resourceType: this.prismaResourceTypeToDto(log.resourceType),
      resourceId: log.resourceId,
      userId: log.userId,
      userName: log.user?.name || null,
      userEmail: log.user?.email || null,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      metadata: log.metadata,
    }));

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (format === AuditExportFormat.CSV) {
      const csv = this.toCSV(exportData);
      return {
        filename: `audit-logs-${timestamp}.csv`,
        contentType: 'text/csv',
        data: csv,
        recordCount: exportData.length,
      };
    }

    // JSON format
    return {
      filename: `audit-logs-${timestamp}.json`,
      contentType: 'application/json',
      data: JSON.stringify(exportData, null, 2),
      recordCount: exportData.length,
    };
  }

  /**
   * Get audit statistics for an organization
   */
  async getStatistics(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalActions: number;
    actionsByType: Record<string, number>;
    actionsByUser: { userId: string; userName: string | null; count: number }[];
    actionsByResource: Record<string, number>;
    dailyActivity: { date: string; count: number }[];
  }> {
    const [actionsByType, actionsByUser, actionsByResource, dailyActivity, total] =
      await Promise.all([
        // Actions by type
        this.prisma.auditLog.groupBy({
          by: ['action'],
          where: {
            organizationId,
            createdAt: { gte: startDate, lte: endDate },
          },
          _count: true,
        }),

        // Actions by user (top 10)
        this.prisma.$queryRaw<{ userId: string; userName: string | null; count: bigint }[]>`
          SELECT
            al.user_id as "userId",
            u.name as "userName",
            COUNT(*)::bigint as count
          FROM audit_logs al
          LEFT JOIN users u ON al.user_id = u.id
          WHERE al.organization_id = ${organizationId}::uuid
            AND al.created_at >= ${startDate}
            AND al.created_at <= ${endDate}
            AND al.user_id IS NOT NULL
          GROUP BY al.user_id, u.name
          ORDER BY count DESC
          LIMIT 10
        `,

        // Actions by resource type
        this.prisma.auditLog.groupBy({
          by: ['resourceType'],
          where: {
            organizationId,
            createdAt: { gte: startDate, lte: endDate },
          },
          _count: true,
        }),

        // Daily activity
        this.prisma.$queryRaw<{ date: Date; count: bigint }[]>`
          SELECT
            DATE(created_at) as date,
            COUNT(*)::bigint as count
          FROM audit_logs
          WHERE organization_id = ${organizationId}::uuid
            AND created_at >= ${startDate}
            AND created_at <= ${endDate}
          GROUP BY DATE(created_at)
          ORDER BY date DESC
        `,

        // Total count
        this.prisma.auditLog.count({
          where: {
            organizationId,
            createdAt: { gte: startDate, lte: endDate },
          },
        }),
      ]);

    return {
      totalActions: total,
      actionsByType: Object.fromEntries(
        actionsByType.map((a) => [this.prismaActionToDto(a.action), a._count]),
      ),
      actionsByUser: actionsByUser.map((u) => ({
        userId: u.userId,
        userName: u.userName,
        count: Number(u.count),
      })),
      actionsByResource: Object.fromEntries(
        actionsByResource.map((r) => [this.prismaResourceTypeToDto(r.resourceType), r._count]),
      ),
      dailyActivity: dailyActivity.map((d) => ({
        date: d.date.toISOString().split('T')[0],
        count: Number(d.count),
      })),
    };
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  /**
   * Convert Prisma action to DTO enum
   */
  private prismaActionToDto(prismaAction: string): AuditAction {
    const mapping: Record<string, AuditAction> = {
      USER_LOGIN: AuditAction.LOGIN,
      USER_LOGOUT: AuditAction.LOGOUT,
      USER_REGISTERED: AuditAction.REGISTER,
      DOCUMENT_CREATED: AuditAction.DOCUMENT_CREATE,
      DOCUMENT_VIEWED: AuditAction.DOCUMENT_READ,
      DOCUMENT_UPDATED: AuditAction.DOCUMENT_UPDATE,
      DOCUMENT_DELETED: AuditAction.DOCUMENT_DELETE,
      DOCUMENT_DOWNLOADED: AuditAction.DOCUMENT_DOWNLOAD,
      DOCUMENT_MOVED: AuditAction.DOCUMENT_MOVE,
      DOCUMENT_COPIED: AuditAction.DOCUMENT_COPY,
      DOCUMENT_RESTORED: AuditAction.DOCUMENT_RESTORE,
      FOLDER_CREATED: AuditAction.FOLDER_CREATE,
      FOLDER_UPDATED: AuditAction.FOLDER_UPDATE,
      FOLDER_DELETED: AuditAction.FOLDER_DELETE,
      FOLDER_MOVED: AuditAction.FOLDER_MOVE,
      PROCESSING_STARTED: AuditAction.PROCESSING_START,
      PROCESSING_COMPLETED: AuditAction.PROCESSING_COMPLETE,
      PROCESSING_FAILED: AuditAction.PROCESSING_FAIL,
      ORGANIZATION_CREATED: AuditAction.ORGANIZATION_CREATE,
      ORGANIZATION_UPDATED: AuditAction.ORGANIZATION_UPDATE,
      MEMBER_INVITED: AuditAction.MEMBER_INVITE,
      MEMBER_REMOVED: AuditAction.MEMBER_REMOVE,
      MEMBER_ROLE_CHANGED: AuditAction.MEMBER_ROLE_CHANGE,
      SETTINGS_UPDATED: AuditAction.SETTINGS_UPDATE,
      API_KEY_CREATED: AuditAction.API_KEY_CREATE,
      API_KEY_REVOKED: AuditAction.API_KEY_REVOKE,
    };

    return mapping[prismaAction] || (prismaAction as AuditAction);
  }

  /**
   * Convert Prisma resource type to DTO enum
   */
  private prismaResourceTypeToDto(prismaType: string): AuditResourceType {
    const mapping: Record<string, AuditResourceType> = {
      USER: AuditResourceType.USER,
      ORGANIZATION: AuditResourceType.ORGANIZATION,
      FOLDER: AuditResourceType.FOLDER,
      DOCUMENT: AuditResourceType.DOCUMENT,
      DOCUMENT_VERSION: AuditResourceType.DOCUMENT_VERSION,
      PROCESSING_JOB: AuditResourceType.PROCESSING_JOB,
      API_KEY: AuditResourceType.API_KEY,
    };

    return mapping[prismaType] || (prismaType as AuditResourceType);
  }

  /**
   * Convert data to CSV format
   */
  private toCSV(
    data: {
      id: string;
      timestamp: string;
      action: string;
      resourceType: string;
      resourceId: string | null;
      userId: string | null;
      userName: string | null;
      userEmail: string | null;
      ipAddress: string | null;
      userAgent: string | null;
      metadata: unknown;
    }[],
  ): string {
    const headers = [
      'id',
      'timestamp',
      'action',
      'resourceType',
      'resourceId',
      'userId',
      'userName',
      'userEmail',
      'ipAddress',
      'userAgent',
      'metadata',
    ];

    const escapeCSV = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = data.map((row) =>
      headers.map((h) => escapeCSV(row[h as keyof typeof row])).join(','),
    );

    return [headers.join(','), ...rows].join('\n');
  }
}
