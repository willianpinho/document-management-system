import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Comprehensive audit action types
 */
export enum AuditAction {
  // Auth actions
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PASSWORD_RESET = 'PASSWORD_RESET',
  PASSWORD_RESET_REQUEST = 'PASSWORD_RESET_REQUEST',
  REGISTER = 'REGISTER',
  SESSION_REVOKED = 'SESSION_REVOKED',
  SESSIONS_REVOKED_ALL = 'SESSIONS_REVOKED_ALL',

  // Document actions
  DOCUMENT_CREATE = 'DOCUMENT_CREATE',
  DOCUMENT_READ = 'DOCUMENT_READ',
  DOCUMENT_UPDATE = 'DOCUMENT_UPDATE',
  DOCUMENT_DELETE = 'DOCUMENT_DELETE',
  DOCUMENT_DOWNLOAD = 'DOCUMENT_DOWNLOAD',
  DOCUMENT_UPLOAD = 'DOCUMENT_UPLOAD',
  DOCUMENT_PROCESS = 'DOCUMENT_PROCESS',
  DOCUMENT_SHARE = 'DOCUMENT_SHARE',
  DOCUMENT_MOVE = 'DOCUMENT_MOVE',
  DOCUMENT_COPY = 'DOCUMENT_COPY',
  DOCUMENT_RESTORE = 'DOCUMENT_RESTORE',

  // Folder actions
  FOLDER_CREATE = 'FOLDER_CREATE',
  FOLDER_READ = 'FOLDER_READ',
  FOLDER_UPDATE = 'FOLDER_UPDATE',
  FOLDER_DELETE = 'FOLDER_DELETE',
  FOLDER_SHARE = 'FOLDER_SHARE',
  FOLDER_UNSHARE = 'FOLDER_UNSHARE',
  FOLDER_MOVE = 'FOLDER_MOVE',

  // Organization actions
  ORGANIZATION_CREATE = 'ORGANIZATION_CREATE',
  ORGANIZATION_UPDATE = 'ORGANIZATION_UPDATE',
  ORGANIZATION_DELETE = 'ORGANIZATION_DELETE',
  MEMBER_INVITE = 'MEMBER_INVITE',
  MEMBER_REMOVE = 'MEMBER_REMOVE',
  MEMBER_ROLE_CHANGE = 'MEMBER_ROLE_CHANGE',
  MEMBER_JOIN = 'MEMBER_JOIN',
  MEMBER_LEAVE = 'MEMBER_LEAVE',

  // Settings actions
  SETTINGS_UPDATE = 'SETTINGS_UPDATE',
  API_KEY_CREATE = 'API_KEY_CREATE',
  API_KEY_REVOKE = 'API_KEY_REVOKE',

  // Processing actions
  PROCESSING_START = 'PROCESSING_START',
  PROCESSING_COMPLETE = 'PROCESSING_COMPLETE',
  PROCESSING_FAIL = 'PROCESSING_FAIL',

  // Search actions
  SEARCH_EXECUTE = 'SEARCH_EXECUTE',

  // User account actions
  DATA_EXPORT = 'DATA_EXPORT',
  ACCOUNT_DELETE = 'ACCOUNT_DELETE',
}

/**
 * Resource types that can be audited
 */
export enum AuditResourceType {
  USER = 'USER',
  ORGANIZATION = 'ORGANIZATION',
  FOLDER = 'FOLDER',
  DOCUMENT = 'DOCUMENT',
  DOCUMENT_VERSION = 'DOCUMENT_VERSION',
  PROCESSING_JOB = 'PROCESSING_JOB',
  API_KEY = 'API_KEY',
  SETTINGS = 'SETTINGS',
}

/**
 * Export format options
 */
export enum AuditExportFormat {
  JSON = 'json',
  CSV = 'csv',
}

// =============================================================================
// QUERY DTOs
// =============================================================================

/**
 * Query parameters for listing audit logs
 */
export class AuditLogQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter by action type',
    enum: AuditAction,
  })
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @ApiPropertyOptional({
    description: 'Filter by resource type',
    enum: AuditResourceType,
  })
  @IsOptional()
  @IsEnum(AuditResourceType)
  resourceType?: AuditResourceType;

  @ApiPropertyOptional({
    description: 'Filter by resource ID',
  })
  @IsOptional()
  @IsUUID()
  resourceId?: string;

  @ApiPropertyOptional({
    description: 'Filter by user ID',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter logs from this date (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter logs until this date (ISO 8601)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by IP address',
  })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({
    description: 'Search in metadata (JSON contains)',
  })
  @IsOptional()
  @IsString()
  metadataSearch?: string;
}

/**
 * Date range parameters
 */
export class DateRangeDto {
  @ApiProperty({
    description: 'Start date (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsDateString()
  startDate!: string;

  @ApiProperty({
    description: 'End date (ISO 8601)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsDateString()
  endDate!: string;
}

/**
 * User activity query parameters
 */
export class UserActivityQueryDto extends DateRangeDto {
  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 50,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 50;
}

/**
 * Export query parameters
 */
export class AuditExportQueryDto extends DateRangeDto {
  @ApiPropertyOptional({
    description: 'Export format',
    enum: AuditExportFormat,
    default: AuditExportFormat.JSON,
  })
  @IsOptional()
  @IsEnum(AuditExportFormat)
  format?: AuditExportFormat = AuditExportFormat.JSON;

  @ApiPropertyOptional({
    description: 'Filter by action type',
    enum: AuditAction,
  })
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @ApiPropertyOptional({
    description: 'Filter by resource type',
    enum: AuditResourceType,
  })
  @IsOptional()
  @IsEnum(AuditResourceType)
  resourceType?: AuditResourceType;

  @ApiPropertyOptional({
    description: 'Filter by user ID',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;
}

// =============================================================================
// RESPONSE DTOs
// =============================================================================

/**
 * User information in audit log
 */
export class AuditUserDto {
  @ApiProperty({ description: 'User ID' })
  id!: string;

  @ApiPropertyOptional({ description: 'User name' })
  name?: string;

  @ApiPropertyOptional({ description: 'User email' })
  email?: string;
}

/**
 * Single audit log entry response
 */
export class AuditLogDto {
  @ApiProperty({ description: 'Audit log ID' })
  id!: string;

  @ApiProperty({ description: 'Organization ID' })
  organizationId!: string;

  @ApiPropertyOptional({ description: 'User who performed the action' })
  user?: AuditUserDto;

  @ApiProperty({
    description: 'Action performed',
    enum: AuditAction,
  })
  action!: AuditAction;

  @ApiProperty({
    description: 'Type of resource affected',
    enum: AuditResourceType,
  })
  resourceType!: AuditResourceType;

  @ApiPropertyOptional({ description: 'ID of the affected resource' })
  resourceId?: string;

  @ApiProperty({
    description: 'Additional metadata about the action',
    example: { oldValue: 'doc.pdf', newValue: 'document.pdf' },
  })
  metadata!: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'IP address of the client' })
  ipAddress?: string;

  @ApiPropertyOptional({ description: 'User agent string' })
  userAgent?: string;

  @ApiProperty({ description: 'Timestamp of the action' })
  createdAt!: Date;
}

/**
 * Paginated audit logs response
 */
export class AuditLogListDto {
  @ApiProperty({
    description: 'List of audit logs',
    type: [AuditLogDto],
  })
  data!: AuditLogDto[];

  @ApiProperty({
    description: 'Pagination metadata',
  })
  meta: {
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  };
}

/**
 * Resource history response
 */
export class ResourceHistoryDto {
  @ApiProperty({ description: 'Resource type' })
  resourceType: AuditResourceType;

  @ApiProperty({ description: 'Resource ID' })
  resourceId: string;

  @ApiProperty({
    description: 'History of actions on this resource',
    type: [AuditLogDto],
  })
  history: AuditLogDto[];

  @ApiProperty({ description: 'Total number of actions' })
  totalActions: number;
}

/**
 * User activity summary
 */
export class UserActivityDto {
  @ApiProperty({ description: 'User information' })
  user: AuditUserDto;

  @ApiProperty({
    description: 'Activity logs',
    type: [AuditLogDto],
  })
  activities: AuditLogDto[];

  @ApiProperty({ description: 'Summary of actions by type' })
  summary: Record<string, number>;

  @ApiProperty({ description: 'Total activities in date range' })
  totalActivities: number;
}

/**
 * Export result
 */
export class AuditExportDto {
  @ApiProperty({ description: 'Export file name' })
  filename: string;

  @ApiProperty({ description: 'MIME type of the export' })
  contentType: string;

  @ApiProperty({ description: 'Export data (base64 encoded for binary)' })
  data: string;

  @ApiProperty({ description: 'Number of records exported' })
  recordCount: number;
}

// =============================================================================
// INPUT DTOs (for internal use)
// =============================================================================

/**
 * Context information for audit logging
 */
export interface AuditContext {
  userId?: string;
  organizationId: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Input for creating an audit log
 */
export interface CreateAuditLogInput {
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  context: AuditContext;
}

/**
 * Metadata for tracking changes
 */
export interface ChangeMetadata {
  oldValue?: unknown;
  newValue?: unknown;
  changedFields?: string[];
  reason?: string;
}
