/**
 * User-related type definitions for the Document Management System.
 * @module @dms/shared/types/user
 */

/**
 * Supported authentication providers for user accounts.
 */
export const AuthProvider = {
  EMAIL: 'email',
  GOOGLE: 'google',
  MICROSOFT: 'microsoft',
} as const;

export type AuthProvider = (typeof AuthProvider)[keyof typeof AuthProvider];

/**
 * Member roles within an organization.
 * Defines permission levels from most restricted to most permissive.
 */
export const MemberRole = {
  /** Read-only access to documents and folders */
  VIEWER: 'viewer',
  /** Read and write access, can create and modify documents */
  EDITOR: 'editor',
  /** Full access including user management and settings */
  ADMIN: 'admin',
  /** Complete control including organization deletion and billing */
  OWNER: 'owner',
} as const;

export type MemberRole = (typeof MemberRole)[keyof typeof MemberRole];

/**
 * Core user entity representing an authenticated user in the system.
 */
export interface User {
  /** Unique identifier (UUID v4) */
  id: string;
  /** User's email address (unique) */
  email: string;
  /** Display name */
  name: string | null;
  /** URL to user's avatar image */
  avatarUrl: string | null;
  /** Authentication provider used for registration */
  provider: AuthProvider | null;
  /** External provider's user ID */
  providerId: string | null;
  /** Whether the user's email has been verified */
  emailVerified: boolean;
  /** Timestamp when the user was created */
  createdAt: Date;
  /** Timestamp when the user was last updated */
  updatedAt: Date;
}

/**
 * User with their role in a specific context (e.g., organization).
 */
export interface UserWithRole extends User {
  /** User's role in the current context */
  role: MemberRole;
}

/**
 * Organization membership details for a user.
 */
export interface OrganizationMembershipInfo {
  /** Organization ID */
  organizationId: string;
  /** Organization name */
  organizationName: string;
  /** Organization slug */
  organizationSlug: string;
  /** User's role in this organization */
  role: MemberRole;
  /** When the user joined this organization */
  joinedAt: Date;
}

/**
 * User with all their organization memberships.
 * Used for user profile and organization switching.
 */
export interface UserWithMemberships extends User {
  /** List of organizations the user belongs to */
  memberships: OrganizationMembershipInfo[];
}

/**
 * Data transfer object for creating a new user.
 */
export interface CreateUserDto {
  /** User's email address */
  email: string;
  /** Display name (optional) */
  name?: string;
  /** Avatar URL (optional) */
  avatarUrl?: string;
  /** Authentication provider (optional, defaults to 'email') */
  provider?: AuthProvider;
  /** External provider's user ID (optional) */
  providerId?: string;
  /** Password hash (required for email provider) */
  passwordHash?: string;
}

/**
 * Data transfer object for updating an existing user.
 */
export interface UpdateUserDto {
  /** Updated display name */
  name?: string;
  /** Updated avatar URL */
  avatarUrl?: string;
}

/**
 * Authentication tokens returned after successful login.
 */
export interface AuthTokens {
  /** JWT access token for API authentication */
  accessToken: string;
  /** Refresh token for obtaining new access tokens */
  refreshToken: string;
  /** Access token expiration time in seconds */
  expiresIn: number;
  /** Token type (always 'Bearer') */
  tokenType: 'Bearer';
}

/**
 * JWT payload structure for access tokens.
 */
export interface JwtPayload {
  /** Subject (user ID) */
  sub: string;
  /** User's email address */
  email: string;
  /** Current organization context (if any) */
  organizationId?: string;
  /** User's role in the organization */
  role?: MemberRole;
  /** Token issued at timestamp (Unix seconds) */
  iat: number;
  /** Token expiration timestamp (Unix seconds) */
  exp: number;
  /** Token ID for revocation tracking */
  jti?: string;
}

/**
 * Refresh token payload structure.
 */
export interface RefreshTokenPayload {
  /** Subject (user ID) */
  sub: string;
  /** Token ID for revocation tracking */
  jti: string;
  /** Token expiration timestamp (Unix seconds) */
  exp: number;
  /** Token type identifier */
  type: 'refresh';
}

/**
 * User session information.
 */
export interface UserSession {
  /** Session ID */
  id: string;
  /** User ID */
  userId: string;
  /** IP address from which session was created */
  ipAddress: string;
  /** User agent string */
  userAgent: string;
  /** When the session was created */
  createdAt: Date;
  /** When the session was last active */
  lastActiveAt: Date;
  /** When the session expires */
  expiresAt: Date;
}
