import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { Request } from 'express';

import { AuditService } from '../audit.service';
import { AUDIT_LOG_KEY, AuditLogOptions } from '../decorators/audit-log.decorator';
import { AuditContext } from '../dto/audit.dto';
import { CurrentUserPayload } from '@/common/decorators/current-user.decorator';

/**
 * Interceptor that automatically logs audit events based on @AuditLog decorator
 *
 * This interceptor:
 * 1. Checks if the method has @AuditLog decorator
 * 2. Extracts context (user, IP, user agent) from the request
 * 3. Extracts resource ID from params or response
 * 4. Builds metadata based on configuration
 * 5. Logs the audit event after successful execution
 *
 * @example
 * ```typescript
 * // In app.module.ts or a feature module
 * providers: [
 *   {
 *     provide: APP_INTERCEPTOR,
 *     useClass: AuditInterceptor,
 *   },
 * ]
 * ```
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Get audit log options from decorator
    const auditOptions = this.reflector.getAllAndOverride<AuditLogOptions | undefined>(
      AUDIT_LOG_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no audit decorator, just pass through
    if (!auditOptions) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as CurrentUserPayload | undefined;

    // Check skip condition
    if (auditOptions.skipCondition && auditOptions.skipCondition(request)) {
      return next.handle();
    }

    // Extract context
    const auditContext = this.extractContext(request, user);

    // If no organization ID, skip audit logging
    if (!auditContext.organizationId) {
      this.logger.debug('Skipping audit log: no organization context');
      return next.handle();
    }

    // Extract resource ID from params if specified
    let resourceId = this.extractResourceId(request, auditOptions);

    // Build initial metadata
    const metadata = this.buildMetadata(request, auditOptions);

    const startTime = Date.now();

    return next.handle().pipe(
      tap((response) => {
        // Try to extract resource ID from response if not found in params
        if (!resourceId && response) {
          resourceId = this.extractResourceIdFromResponse(response);
        }

        // Add response data if configured
        if (auditOptions.includeResponse && response) {
          metadata.response = this.redactFields(response, auditOptions.redactFields);
        }

        // Add execution time
        metadata.executionTimeMs = Date.now() - startTime;

        // Log the audit event asynchronously (don't await)
        this.auditService
          .log(
            auditOptions.action,
            auditOptions.resourceType,
            resourceId,
            metadata,
            auditContext,
          )
          .catch((err) => {
            this.logger.error(`Failed to log audit event: ${err.message}`);
          });
      }),
      catchError((error) => {
        // Log failed actions with error information
        metadata.error = {
          name: error.name,
          message: error.message,
          status: error.status || error.statusCode,
        };
        metadata.executionTimeMs = Date.now() - startTime;
        metadata.success = false;

        // Log the failed action asynchronously
        this.auditService
          .log(
            auditOptions.action,
            auditOptions.resourceType,
            resourceId,
            metadata,
            auditContext,
          )
          .catch((err) => {
            this.logger.error(`Failed to log audit event for error: ${err.message}`);
          });

        return throwError(() => error);
      }),
    );
  }

  /**
   * Extract audit context from request
   */
  private extractContext(
    request: Request,
    user: CurrentUserPayload | undefined,
  ): AuditContext {
    // Get IP address (handle proxies)
    const ipAddress =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (request.headers['x-real-ip'] as string) ||
      request.socket.remoteAddress ||
      request.ip;

    // Get user agent
    const userAgent = request.headers['user-agent'] || undefined;

    // Get organization ID from various sources
    const organizationId =
      user?.organizationId ||
      (request.params.organizationId as string) ||
      (request.query.organizationId as string) ||
      (request.headers['x-organization-id'] as string) ||
      '';

    return {
      userId: user?.id,
      organizationId,
      ipAddress,
      userAgent,
    };
  }

  /**
   * Extract resource ID from request params
   */
  private extractResourceId(
    request: Request,
    options: AuditLogOptions,
  ): string | null {
    if (options.resourceIdParam) {
      return (request.params[options.resourceIdParam] as string) || null;
    }

    // Try common param names
    return (
      (request.params.id as string) ||
      (request.params.documentId as string) ||
      (request.params.folderId as string) ||
      null
    );
  }

  /**
   * Extract resource ID from response
   */
  private extractResourceIdFromResponse(response: unknown): string | null {
    if (!response || typeof response !== 'object') {
      return null;
    }

    const obj = response as Record<string, unknown>;

    // Check common response structures
    if (obj.id && typeof obj.id === 'string') {
      return obj.id;
    }

    if (obj.data && typeof obj.data === 'object') {
      const data = obj.data as Record<string, unknown>;
      if (data.id && typeof data.id === 'string') {
        return data.id;
      }
    }

    // For create operations that return { document: {...} } etc
    const resourceKeys = ['document', 'folder', 'organization', 'user'];
    for (const key of resourceKeys) {
      if (obj[key] && typeof obj[key] === 'object') {
        const resource = obj[key] as Record<string, unknown>;
        if (resource.id && typeof resource.id === 'string') {
          return resource.id;
        }
      }
    }

    return null;
  }

  /**
   * Build metadata object based on options
   */
  private buildMetadata(
    request: Request,
    options: AuditLogOptions,
  ): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      method: request.method,
      path: request.path,
      timestamp: new Date().toISOString(),
      success: true,
    };

    if (options.includeBody && request.body) {
      metadata.body = this.redactFields(request.body, options.redactFields);
    }

    if (options.includeQuery && request.query) {
      metadata.query = this.redactFields(request.query, options.redactFields);
    }

    return metadata;
  }

  /**
   * Redact sensitive fields from an object
   */
  private redactFields(
    obj: unknown,
    fieldsToRedact?: string[],
  ): unknown {
    if (!fieldsToRedact || fieldsToRedact.length === 0) {
      return obj;
    }

    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.redactFields(item, fieldsToRedact));
    }

    const result: Record<string, unknown> = {};
    const source = obj as Record<string, unknown>;

    for (const [key, value] of Object.entries(source)) {
      if (fieldsToRedact.includes(key)) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.redactFields(value, fieldsToRedact);
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}
