/**
 * Organization-related type definitions for the Document Management System.
 * @module @dms/shared/types/organization
 */

import type { MemberRole, User } from './user.js';

/**
 * Available subscription plans for organizations.
 */
export const OrganizationPlan = {
  /** Free tier with basic features and limited storage */
  FREE: 'free',
  /** Starter plan for small teams */
  STARTER: 'starter',
  /** Professional plan for growing teams */
  PRO: 'professional',
  /** Enterprise plan with unlimited features */
  ENTERPRISE: 'enterprise',
} as const;

export type OrganizationPlan = (typeof OrganizationPlan)[keyof typeof OrganizationPlan];

/**
 * Plan feature limits and quotas.
 */
export interface PlanLimits {
  /** Storage quota in bytes */
  storageBytes: bigint;
  /** Maximum number of members (-1 for unlimited) */
  maxMembers: number;
  /** Maximum file size in bytes */
  maxFileSizeBytes: bigint;
  /** Whether OCR processing is available */
  ocrEnabled: boolean;
  /** Whether AI classification is available */
  aiClassificationEnabled: boolean;
  /** Whether semantic search is available */
  semanticSearchEnabled: boolean;
  /** API rate limit (requests per minute) */
  apiRateLimit: number;
  /** Version history retention days (-1 for unlimited) */
  versionRetentionDays: number;
}

/**
 * Plan limits configuration for all available plans.
 */
export const PLAN_LIMITS: Record<OrganizationPlan, PlanLimits> = {
  free: {
    storageBytes: BigInt(5 * 1024 * 1024 * 1024), // 5GB
    maxMembers: 3,
    maxFileSizeBytes: BigInt(100 * 1024 * 1024), // 100MB
    ocrEnabled: false,
    aiClassificationEnabled: false,
    semanticSearchEnabled: false,
    apiRateLimit: 60,
    versionRetentionDays: 7,
  },
  starter: {
    storageBytes: BigInt(50 * 1024 * 1024 * 1024), // 50GB
    maxMembers: 10,
    maxFileSizeBytes: BigInt(500 * 1024 * 1024), // 500MB
    ocrEnabled: true,
    aiClassificationEnabled: false,
    semanticSearchEnabled: false,
    apiRateLimit: 300,
    versionRetentionDays: 30,
  },
  professional: {
    storageBytes: BigInt(500 * 1024 * 1024 * 1024), // 500GB
    maxMembers: 50,
    maxFileSizeBytes: BigInt(2 * 1024 * 1024 * 1024), // 2GB
    ocrEnabled: true,
    aiClassificationEnabled: true,
    semanticSearchEnabled: true,
    apiRateLimit: 1000,
    versionRetentionDays: 90,
  },
  enterprise: {
    storageBytes: BigInt(5 * 1024 * 1024 * 1024 * 1024), // 5TB
    maxMembers: -1, // Unlimited
    maxFileSizeBytes: BigInt(10 * 1024 * 1024 * 1024), // 10GB
    ocrEnabled: true,
    aiClassificationEnabled: true,
    semanticSearchEnabled: true,
    apiRateLimit: -1, // Unlimited
    versionRetentionDays: -1, // Unlimited
  },
};

/**
 * Core organization entity representing a tenant in the multi-tenant system.
 */
export interface Organization {
  /** Unique identifier (UUID v4) */
  id: string;
  /** Organization display name */
  name: string;
  /** URL-friendly unique identifier */
  slug: string;
  /** Current subscription plan */
  plan: OrganizationPlan;
  /** Storage quota in bytes */
  storageQuotaBytes: bigint;
  /** Organization logo URL */
  logoUrl: string | null;
  /** Whether the organization is active */
  isActive: boolean;
  /** Timestamp when the organization was created */
  createdAt: Date;
  /** Timestamp when the organization was last updated */
  updatedAt: Date;
}

/**
 * Organization member entity representing the relationship between users and organizations.
 */
export interface OrganizationMember {
  /** Unique identifier */
  id: string;
  /** Organization ID */
  organizationId: string;
  /** User ID */
  userId: string;
  /** Member's role within the organization */
  role: MemberRole;
  /** Timestamp when the member joined */
  createdAt: Date;
  /** Timestamp when the membership was last updated */
  updatedAt: Date;
  /** Associated user details (populated when needed) */
  user?: User;
}

/**
 * Organization with all members populated.
 */
export interface OrganizationWithMembers extends Organization {
  /** List of organization members */
  members: OrganizationMember[];
  /** Total storage used in bytes */
  usedStorageBytes: bigint;
}

/**
 * Organization with detailed storage statistics.
 */
export interface OrganizationWithStats extends Organization {
  /** Total storage used in bytes */
  usedStorageBytes: bigint;
  /** Total number of documents */
  documentCount: number;
  /** Total number of folders */
  folderCount: number;
  /** Total number of members */
  memberCount: number;
}

/**
 * Storage usage information for an organization.
 */
export interface StorageUsage {
  /** Total bytes used */
  usedBytes: bigint;
  /** Total quota in bytes */
  quotaBytes: bigint;
  /** Percentage of quota used (0-100) */
  percentUsed: number;
  /** Whether storage is near limit (>80%) */
  isNearLimit: boolean;
  /** Whether storage limit has been reached */
  isAtLimit: boolean;
}

/**
 * Data transfer object for creating a new organization.
 */
export interface CreateOrganizationDto {
  /** Organization display name */
  name: string;
  /** URL-friendly slug (must be unique) */
  slug: string;
  /** Initial plan (defaults to 'free') */
  plan?: OrganizationPlan;
}

/**
 * Data transfer object for updating an existing organization.
 */
export interface UpdateOrganizationDto {
  /** Updated organization name */
  name?: string;
  /** Updated logo URL */
  logoUrl?: string | null;
}

/**
 * Data transfer object for inviting a member to an organization.
 */
export interface InviteMemberDto {
  /** Email address of the user to invite */
  email: string;
  /** Role to assign (cannot be 'owner') */
  role: Exclude<MemberRole, 'owner'>;
}

/**
 * Data transfer object for updating a member's role.
 */
export interface UpdateMemberRoleDto {
  /** New role to assign (cannot be 'owner') */
  role: Exclude<MemberRole, 'owner'>;
}

/**
 * Organization invitation entity.
 */
export interface OrganizationInvitation {
  /** Unique identifier */
  id: string;
  /** Organization ID */
  organizationId: string;
  /** Email address of the invitee */
  email: string;
  /** Role that will be assigned upon acceptance */
  role: MemberRole;
  /** Invitation token */
  token: string;
  /** User who sent the invitation */
  invitedById: string;
  /** Timestamp when the invitation expires */
  expiresAt: Date;
  /** Timestamp when the invitation was created */
  createdAt: Date;
}

/**
 * API key for machine-to-machine authentication.
 */
export interface ApiKey {
  /** Unique identifier */
  id: string;
  /** Organization ID */
  organizationId: string;
  /** API key name/description */
  name: string;
  /** Key prefix for identification (first 8 chars) */
  keyPrefix: string;
  /** Hashed API key (never expose the full key) */
  keyHash: string;
  /** Permissions/scopes for this key */
  scopes: string[];
  /** Last time the key was used */
  lastUsedAt: Date | null;
  /** When the key expires (null for no expiration) */
  expiresAt: Date | null;
  /** Timestamp when the key was created */
  createdAt: Date;
  /** User who created the key */
  createdById: string;
}

/**
 * Response when creating a new API key (includes the full key only once).
 */
export interface CreateApiKeyResponse {
  /** API key metadata */
  apiKey: ApiKey;
  /** The full API key (only shown once, cannot be retrieved later) */
  secretKey: string;
}

// Re-export MemberRole for convenience
export { MemberRole } from './user.js';
