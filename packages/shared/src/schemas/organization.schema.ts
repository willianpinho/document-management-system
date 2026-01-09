/**
 * Organization Zod schemas.
 * @module @dms/shared/schemas/organization
 */

import { z } from 'zod';

import { slugSchema, urlSchema } from './common.schema.js';
import { emailSchema, memberRoleSchema } from './user.schema.js';

/**
 * Organization plan schema.
 */
export const organizationPlanSchema = z.enum(['free', 'starter', 'professional', 'enterprise']);

/**
 * Organization name schema.
 */
export const organizationNameSchema = z
  .string()
  .min(1, 'Organization name is required')
  .max(255, 'Organization name must be at most 255 characters')
  .transform((name) => name.trim());

/**
 * Create organization schema.
 */
export const createOrganizationSchema = z.object({
  name: organizationNameSchema,
  slug: slugSchema,
  plan: organizationPlanSchema.optional().default('free'),
});

/**
 * Update organization schema.
 */
export const updateOrganizationSchema = z.object({
  name: organizationNameSchema.optional(),
  logoUrl: urlSchema.optional().nullable(),
});

/**
 * Invite member schema.
 */
export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: memberRoleSchema.exclude(['owner']),
});

/**
 * Update member role schema.
 */
export const updateMemberRoleSchema = z.object({
  role: memberRoleSchema.exclude(['owner']),
});

/**
 * Remove member schema.
 */
export const removeMemberSchema = z.object({
  memberId: z.string().uuid(),
  transferOwnedDocuments: z.boolean().default(false),
  targetOwnerId: z.string().uuid().optional(),
});

/**
 * Accept invitation schema.
 */
export const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
});

/**
 * Switch organization schema.
 */
export const switchOrganizationSchema = z.object({
  organizationId: z.string().uuid(),
});

/**
 * Organization settings schema.
 */
export const organizationSettingsSchema = z.object({
  allowPublicSharing: z.boolean().optional(),
  defaultMemberRole: memberRoleSchema.exclude(['owner']).optional(),
  requireTwoFactor: z.boolean().optional(),
  allowedDomains: z.array(z.string()).optional(),
  retentionDays: z.number().int().min(1).max(365).optional(),
});

/**
 * Inferred types from schemas.
 */
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type SwitchOrganizationInput = z.infer<typeof switchOrganizationSchema>;
export type OrganizationSettingsInput = z.infer<typeof organizationSettingsSchema>;
