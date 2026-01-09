import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';

import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationGuard } from '@/common/guards/organization.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { CurrentUser, CurrentUserPayload } from '@/common/decorators/current-user.decorator';
import { Roles, Role } from '@/common/decorators/roles.decorator';
import {
  AuditLogQueryDto,
  AuditExportQueryDto,
  UserActivityQueryDto,
  AuditResourceType,
  AuditLogListDto,
  ResourceHistoryDto,
  UserActivityDto,
  AuditExportFormat,
} from './dto/audit.dto';

@ApiTags('audit')
@Controller('audit')
@UseGuards(JwtAuthGuard, OrganizationGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'List audit logs',
    description: 'Get paginated list of audit logs with optional filters. Requires ADMIN role.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of audit logs',
    type: AuditLogListDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getAuditLogs(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: AuditLogQueryDto,
  ): Promise<AuditLogListDto> {
    return this.auditService.getAuditLogs(user.organizationId!, query);
  }

  @Get('logs/:resourceType/:resourceId')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Get resource history',
    description: 'Get complete audit history for a specific resource. Requires ADMIN role.',
  })
  @ApiParam({
    name: 'resourceType',
    description: 'Type of resource',
    enum: AuditResourceType,
  })
  @ApiParam({
    name: 'resourceId',
    description: 'ID of the resource',
  })
  @ApiResponse({
    status: 200,
    description: 'Resource audit history',
    type: ResourceHistoryDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getResourceHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Param('resourceType') resourceType: AuditResourceType,
    @Param('resourceId') resourceId: string,
  ): Promise<ResourceHistoryDto> {
    return this.auditService.getResourceHistory(
      user.organizationId!,
      resourceType,
      resourceId,
    );
  }

  @Get('users/:userId/activity')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Get user activity',
    description: 'Get audit logs for a specific user within a date range. Requires ADMIN role.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID to get activity for',
  })
  @ApiResponse({
    status: 200,
    description: 'User activity with summary',
    type: UserActivityDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getUserActivity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('userId') userId: string,
    @Query() query: UserActivityQueryDto,
  ): Promise<UserActivityDto> {
    return this.auditService.getUserActivity(
      user.organizationId!,
      userId,
      new Date(query.startDate),
      new Date(query.endDate),
      query.page,
      query.limit,
    );
  }

  @Get('export')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Export audit logs',
    description: 'Export audit logs in CSV or JSON format. Requires ADMIN role.',
  })
  @ApiQuery({
    name: 'startDate',
    required: true,
    type: String,
    description: 'Start date (ISO 8601)',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    type: String,
    description: 'End date (ISO 8601)',
  })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: AuditExportFormat,
    description: 'Export format (json or csv)',
  })
  @ApiResponse({
    status: 200,
    description: 'Exported audit logs file',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async exportLogs(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: AuditExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const exportResult = await this.auditService.exportLogs(
      user.organizationId!,
      new Date(query.startDate),
      new Date(query.endDate),
      query.format || AuditExportFormat.JSON,
      {
        action: query.action,
        resourceType: query.resourceType,
        userId: query.userId,
      },
    );

    res.set({
      'Content-Type': exportResult.contentType,
      'Content-Disposition': `attachment; filename="${exportResult.filename}"`,
      'X-Record-Count': exportResult.recordCount.toString(),
    });

    return new StreamableFile(Buffer.from(exportResult.data, 'utf-8'));
  }

  @Get('statistics')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Get audit statistics',
    description: 'Get aggregated audit statistics for the organization. Requires ADMIN role.',
  })
  @ApiQuery({
    name: 'startDate',
    required: true,
    type: String,
    description: 'Start date (ISO 8601)',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    type: String,
    description: 'End date (ISO 8601)',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit statistics',
    schema: {
      type: 'object',
      properties: {
        totalActions: { type: 'number' },
        actionsByType: { type: 'object', additionalProperties: { type: 'number' } },
        actionsByUser: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              userId: { type: 'string' },
              userName: { type: 'string', nullable: true },
              count: { type: 'number' },
            },
          },
        },
        actionsByResource: { type: 'object', additionalProperties: { type: 'number' } },
        dailyActivity: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string' },
              count: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getStatistics(
    @CurrentUser() user: CurrentUserPayload,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.auditService.getStatistics(
      user.organizationId!,
      new Date(startDate),
      new Date(endDate),
    );
  }
}
