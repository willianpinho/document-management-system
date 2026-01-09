// Module
export { AuditModule } from './audit.module';

// Service
export { AuditService } from './audit.service';

// Controller
export { AuditController } from './audit.controller';

// DTOs and Types
export {
  // Enums
  AuditAction,
  AuditResourceType,
  AuditExportFormat,
  // Query DTOs
  AuditLogQueryDto,
  DateRangeDto,
  UserActivityQueryDto,
  AuditExportQueryDto,
  // Response DTOs
  AuditUserDto,
  AuditLogDto,
  AuditLogListDto,
  ResourceHistoryDto,
  UserActivityDto,
  AuditExportDto,
  // Input Types
  AuditContext,
  CreateAuditLogInput,
  ChangeMetadata,
} from './dto/audit.dto';

// Decorators
export {
  AuditLog,
  AuditDocument,
  AuditFolder,
  AuditOrganization,
  AuditUser,
  AUDIT_LOG_KEY,
  type AuditLogOptions,
} from './decorators/audit-log.decorator';

// Interceptor
export { AuditInterceptor } from './interceptors/audit.interceptor';
