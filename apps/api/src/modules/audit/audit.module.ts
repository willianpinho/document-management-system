import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './interceptors/audit.interceptor';

/**
 * Audit Module
 *
 * Provides comprehensive audit logging functionality for the DMS.
 * This module is global to allow audit logging from any part of the application.
 *
 * Features:
 * - Automatic audit logging via @AuditLog decorator and interceptor
 * - Manual audit logging via AuditService
 * - Query and export audit logs
 * - User activity tracking
 * - Resource history
 * - Audit statistics
 *
 * @example Using @AuditLog decorator
 * ```typescript
 * import { AuditLog, AuditDocument } from '@/modules/audit';
 *
 * @AuditDocument(AuditAction.DOCUMENT_CREATE, { includeBody: true })
 * @Post()
 * async create(@Body() dto: CreateDocumentDto) {
 *   // Audit log is created automatically after successful execution
 * }
 * ```
 *
 * @example Manual audit logging
 * ```typescript
 * import { AuditService, AuditAction, AuditResourceType } from '@/modules/audit';
 *
 * constructor(private readonly auditService: AuditService) {}
 *
 * async someMethod() {
 *   await this.auditService.log(
 *     AuditAction.DOCUMENT_DOWNLOAD,
 *     AuditResourceType.DOCUMENT,
 *     documentId,
 *     { fileName: 'doc.pdf' },
 *     { userId, organizationId, ipAddress, userAgent },
 *   );
 * }
 * ```
 */
@Global()
@Module({
  controllers: [AuditController],
  providers: [
    AuditService,
    // Register the audit interceptor globally
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  exports: [AuditService],
})
export class AuditModule {}
