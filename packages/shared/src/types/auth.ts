/**
 * Authentication type definitions for the Document Management System.
 * @module @dms/shared/types/auth
 */

import type { AuthProvider, AuthTokens, JwtPayload, MemberRole, User } from './user.js';

/**
 * Data transfer object for email/password login.
 */
export interface LoginDto {
  /** User's email address */
  email: string;
  /** User's password */
  password: string;
  /** Remember me flag for extended session */
  rememberMe?: boolean;
  /** Organization slug to log into (optional) */
  organizationSlug?: string;
}

/**
 * Data transfer object for user registration.
 */
export interface RegisterDto {
  /** User's email address */
  email: string;
  /** User's password (min 8 characters) */
  password: string;
  /** User's display name (optional) */
  name?: string;
  /** Organization name to create (optional) */
  organizationName?: string;
  /** Invitation token (optional, for joining existing org) */
  invitationToken?: string;
}

/**
 * Response containing authentication tokens.
 */
export interface TokensResponse extends AuthTokens {
  /** Authenticated user details */
  user: User;
}

/**
 * Data transfer object for token refresh.
 */
export interface RefreshTokenDto {
  /** Refresh token */
  refreshToken: string;
}

/**
 * Data transfer object for password change.
 */
export interface ChangePasswordDto {
  /** Current password */
  currentPassword: string;
  /** New password (min 8 characters) */
  newPassword: string;
}

/**
 * Data transfer object for forgot password request.
 */
export interface ForgotPasswordDto {
  /** User's email address */
  email: string;
}

/**
 * Data transfer object for password reset.
 */
export interface ResetPasswordDto {
  /** Password reset token */
  token: string;
  /** New password (min 8 characters) */
  newPassword: string;
}

/**
 * Data transfer object for email verification.
 */
export interface VerifyEmailDto {
  /** Verification token */
  token: string;
}

/**
 * OAuth state for CSRF protection.
 */
export interface OAuthState {
  /** Random state value */
  state: string;
  /** Original redirect URL */
  redirectUrl: string;
  /** Organization slug (if specified) */
  organizationSlug?: string;
  /** Invitation token (if joining via invite) */
  invitationToken?: string;
  /** Timestamp when state was created */
  createdAt: number;
}

/**
 * OAuth callback data.
 */
export interface OAuthCallback {
  /** Authorization code from OAuth provider */
  code: string;
  /** State value for CSRF verification */
  state: string;
  /** Error from OAuth provider (if any) */
  error?: string;
  /** Error description from OAuth provider */
  errorDescription?: string;
}

/**
 * OAuth user profile from provider.
 */
export interface OAuthProfile {
  /** Provider identifier */
  provider: AuthProvider;
  /** User ID from provider */
  providerId: string;
  /** User's email */
  email: string;
  /** Whether email is verified by provider */
  emailVerified: boolean;
  /** User's name */
  name?: string;
  /** User's profile picture URL */
  avatarUrl?: string;
  /** Raw profile data from provider */
  rawProfile?: Record<string, unknown>;
}

/**
 * Session information for the current user.
 */
export interface Session {
  /** Session ID */
  id: string;
  /** User ID */
  userId: string;
  /** Current organization ID */
  organizationId: string | null;
  /** User's role in current organization */
  role: MemberRole | null;
  /** Session creation time */
  createdAt: Date;
  /** Last activity time */
  lastActiveAt: Date;
  /** Session expiration time */
  expiresAt: Date;
  /** IP address */
  ipAddress: string;
  /** User agent string */
  userAgent: string;
  /** Device info parsed from user agent */
  device?: {
    browser: string;
    os: string;
    device: string;
  };
}

/**
 * Current user context with permissions.
 */
export interface AuthContext {
  /** Current user */
  user: User;
  /** Current organization ID */
  organizationId: string | null;
  /** User's role in current organization */
  role: MemberRole | null;
  /** Computed permissions */
  permissions: string[];
  /** Session information */
  session: Session;
}

/**
 * Permission definitions for RBAC.
 */
export const Permission = {
  // Document permissions
  DOCUMENTS_READ: 'documents:read',
  DOCUMENTS_WRITE: 'documents:write',
  DOCUMENTS_DELETE: 'documents:delete',
  DOCUMENTS_SHARE: 'documents:share',

  // Folder permissions
  FOLDERS_READ: 'folders:read',
  FOLDERS_WRITE: 'folders:write',
  FOLDERS_DELETE: 'folders:delete',

  // Processing permissions
  PROCESSING_TRIGGER: 'processing:trigger',
  PROCESSING_VIEW: 'processing:view',

  // Organization permissions
  ORG_READ: 'organization:read',
  ORG_UPDATE: 'organization:update',
  ORG_DELETE: 'organization:delete',
  ORG_BILLING: 'organization:billing',

  // Member permissions
  MEMBERS_READ: 'members:read',
  MEMBERS_INVITE: 'members:invite',
  MEMBERS_UPDATE: 'members:update',
  MEMBERS_REMOVE: 'members:remove',

  // API key permissions
  API_KEYS_READ: 'api_keys:read',
  API_KEYS_CREATE: 'api_keys:create',
  API_KEYS_DELETE: 'api_keys:delete',

  // Admin permissions
  ADMIN_ACCESS: 'admin:access',
  ADMIN_AUDIT_LOGS: 'admin:audit_logs',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

/**
 * Role to permissions mapping.
 */
export const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  viewer: [
    Permission.DOCUMENTS_READ,
    Permission.FOLDERS_READ,
    Permission.PROCESSING_VIEW,
    Permission.ORG_READ,
    Permission.MEMBERS_READ,
  ],
  editor: [
    Permission.DOCUMENTS_READ,
    Permission.DOCUMENTS_WRITE,
    Permission.FOLDERS_READ,
    Permission.FOLDERS_WRITE,
    Permission.PROCESSING_TRIGGER,
    Permission.PROCESSING_VIEW,
    Permission.ORG_READ,
    Permission.MEMBERS_READ,
  ],
  admin: [
    Permission.DOCUMENTS_READ,
    Permission.DOCUMENTS_WRITE,
    Permission.DOCUMENTS_DELETE,
    Permission.DOCUMENTS_SHARE,
    Permission.FOLDERS_READ,
    Permission.FOLDERS_WRITE,
    Permission.FOLDERS_DELETE,
    Permission.PROCESSING_TRIGGER,
    Permission.PROCESSING_VIEW,
    Permission.ORG_READ,
    Permission.ORG_UPDATE,
    Permission.MEMBERS_READ,
    Permission.MEMBERS_INVITE,
    Permission.MEMBERS_UPDATE,
    Permission.MEMBERS_REMOVE,
    Permission.API_KEYS_READ,
    Permission.API_KEYS_CREATE,
    Permission.API_KEYS_DELETE,
    Permission.ADMIN_ACCESS,
    Permission.ADMIN_AUDIT_LOGS,
  ],
  owner: Object.values(Permission) as Permission[],
};

/**
 * API key authentication details.
 */
export interface ApiKeyAuth {
  /** API key ID */
  keyId: string;
  /** Organization ID */
  organizationId: string;
  /** Key name */
  name: string;
  /** Granted scopes/permissions */
  scopes: string[];
}

/**
 * Two-factor authentication setup response.
 */
export interface TwoFactorSetup {
  /** Secret key for TOTP */
  secret: string;
  /** QR code data URL */
  qrCodeUrl: string;
  /** Backup codes */
  backupCodes: string[];
}

/**
 * Two-factor authentication verification.
 */
export interface TwoFactorVerify {
  /** TOTP code or backup code */
  code: string;
  /** Whether this is a backup code */
  isBackupCode?: boolean;
}

/**
 * Password policy configuration.
 */
export interface PasswordPolicy {
  /** Minimum password length */
  minLength: number;
  /** Require uppercase letters */
  requireUppercase: boolean;
  /** Require lowercase letters */
  requireLowercase: boolean;
  /** Require numbers */
  requireNumbers: boolean;
  /** Require special characters */
  requireSpecialChars: boolean;
  /** List of disallowed passwords */
  disallowedPasswords: string[];
}

/**
 * Default password policy.
 */
export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false,
  disallowedPasswords: ['password', '12345678', 'qwerty123'],
};

/**
 * Audit log entry for authentication events.
 */
export interface AuthAuditLog {
  /** Log entry ID */
  id: string;
  /** User ID (if known) */
  userId: string | null;
  /** Event type */
  event: AuthEvent;
  /** IP address */
  ipAddress: string;
  /** User agent */
  userAgent: string;
  /** Whether the action was successful */
  success: boolean;
  /** Failure reason (if applicable) */
  failureReason?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Timestamp */
  createdAt: Date;
}

/**
 * Authentication event types for audit logging.
 */
export const AuthEvent = {
  LOGIN_SUCCESS: 'login.success',
  LOGIN_FAILED: 'login.failed',
  LOGOUT: 'logout',
  TOKEN_REFRESH: 'token.refresh',
  PASSWORD_CHANGED: 'password.changed',
  PASSWORD_RESET_REQUESTED: 'password.reset_requested',
  PASSWORD_RESET_COMPLETED: 'password.reset_completed',
  EMAIL_VERIFIED: 'email.verified',
  TWO_FACTOR_ENABLED: 'two_factor.enabled',
  TWO_FACTOR_DISABLED: 'two_factor.disabled',
  API_KEY_CREATED: 'api_key.created',
  API_KEY_DELETED: 'api_key.deleted',
  SESSION_REVOKED: 'session.revoked',
} as const;

export type AuthEvent = (typeof AuthEvent)[keyof typeof AuthEvent];

// Re-export common auth types
export type { AuthProvider, AuthTokens, JwtPayload } from './user.js';
