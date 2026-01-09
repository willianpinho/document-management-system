import { SetMetadata } from '@nestjs/common';
import { AuditAction, AuditResourceType } from '../dto/audit.dto';

/**
 * Metadata key for audit log configuration
 */
export const AUDIT_LOG_KEY = 'audit_log';

/**
 * Configuration options for audit logging
 */
export interface AuditLogOptions {
  /**
   * The action being performed
   */
  action: AuditAction;

  /**
   * The type of resource being affected
   */
  resourceType: AuditResourceType;

  /**
   * Optional: Name of the parameter that contains the resource ID
   * If not specified, will try to extract from 'id' param or response
   */
  resourceIdParam?: string;

  /**
   * Optional: Whether to include request body in metadata
   * @default false
   */
  includeBody?: boolean;

  /**
   * Optional: Whether to include query params in metadata
   * @default false
   */
  includeQuery?: boolean;

  /**
   * Optional: Whether to include response data in metadata
   * @default false
   */
  includeResponse?: boolean;

  /**
   * Optional: Custom metadata extractor function name
   * The function should be a method on the controller
   */
  metadataExtractor?: string;

  /**
   * Optional: Skip audit logging if this condition returns true
   * Function receives the request object
   */
  skipCondition?: (req: unknown) => boolean;

  /**
   * Optional: Fields to redact from body/response in metadata
   * Useful for sensitive data like passwords
   */
  redactFields?: string[];
}

/**
 * Decorator to enable automatic audit logging for controller methods
 *
 * @example
 * ```typescript
 * @AuditLog({
 *   action: AuditAction.DOCUMENT_CREATE,
 *   resourceType: AuditResourceType.DOCUMENT,
 *   includeBody: true,
 * })
 * @Post()
 * async create(@Body() dto: CreateDocumentDto) {
 *   // ...
 * }
 * ```
 *
 * @example With resource ID from param
 * ```typescript
 * @AuditLog({
 *   action: AuditAction.DOCUMENT_UPDATE,
 *   resourceType: AuditResourceType.DOCUMENT,
 *   resourceIdParam: 'id',
 * })
 * @Patch(':id')
 * async update(@Param('id') id: string, @Body() dto: UpdateDocumentDto) {
 *   // ...
 * }
 * ```
 *
 * @example With field redaction
 * ```typescript
 * @AuditLog({
 *   action: AuditAction.PASSWORD_CHANGE,
 *   resourceType: AuditResourceType.USER,
 *   includeBody: true,
 *   redactFields: ['password', 'oldPassword', 'newPassword'],
 * })
 * @Post('change-password')
 * async changePassword(@Body() dto: ChangePasswordDto) {
 *   // ...
 * }
 * ```
 */
export const AuditLog = (options: AuditLogOptions) =>
  SetMetadata(AUDIT_LOG_KEY, options);

/**
 * Shorthand decorator for document actions
 */
export const AuditDocument = (
  action: AuditAction,
  options?: Partial<Omit<AuditLogOptions, 'action' | 'resourceType'>>,
) =>
  AuditLog({
    action,
    resourceType: AuditResourceType.DOCUMENT,
    resourceIdParam: 'id',
    ...options,
  });

/**
 * Shorthand decorator for folder actions
 */
export const AuditFolder = (
  action: AuditAction,
  options?: Partial<Omit<AuditLogOptions, 'action' | 'resourceType'>>,
) =>
  AuditLog({
    action,
    resourceType: AuditResourceType.FOLDER,
    resourceIdParam: 'id',
    ...options,
  });

/**
 * Shorthand decorator for organization actions
 */
export const AuditOrganization = (
  action: AuditAction,
  options?: Partial<Omit<AuditLogOptions, 'action' | 'resourceType'>>,
) =>
  AuditLog({
    action,
    resourceType: AuditResourceType.ORGANIZATION,
    resourceIdParam: 'id',
    ...options,
  });

/**
 * Shorthand decorator for user actions
 */
export const AuditUser = (
  action: AuditAction,
  options?: Partial<Omit<AuditLogOptions, 'action' | 'resourceType'>>,
) =>
  AuditLog({
    action,
    resourceType: AuditResourceType.USER,
    ...options,
  });
