/**
 * User and authentication Zod schemas.
 * @module @dms/shared/schemas/user
 */

import { z } from 'zod';

import { urlSchema } from './common.schema.js';

/**
 * Email validation schema.
 */
export const emailSchema = z
  .string()
  .email('Invalid email address')
  .max(255, 'Email must be at most 255 characters')
  .transform((email) => email.toLowerCase().trim());

/**
 * Password validation schema with security requirements.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine(
    (password) => /[A-Z]/.test(password),
    'Password must contain at least one uppercase letter'
  )
  .refine(
    (password) => /[a-z]/.test(password),
    'Password must contain at least one lowercase letter'
  )
  .refine(
    (password) => /[0-9]/.test(password),
    'Password must contain at least one number'
  );

/**
 * Simple password schema (for login, less strict).
 */
export const simplePasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

/**
 * Member role schema.
 */
export const memberRoleSchema = z.enum(['viewer', 'editor', 'admin', 'owner']);

/**
 * Auth provider schema.
 */
export const authProviderSchema = z.enum(['email', 'google', 'microsoft']);

/**
 * Display name schema.
 */
export const displayNameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(255, 'Name must be at most 255 characters')
  .transform((name) => name.trim());

/**
 * Login request schema.
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: simplePasswordSchema,
  rememberMe: z.boolean().default(false),
  organizationSlug: z.string().optional(),
});

/**
 * Registration request schema.
 */
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: displayNameSchema.optional(),
  organizationName: z.string().min(1).max(255).optional(),
  invitationToken: z.string().optional(),
});

/**
 * Update user profile schema.
 */
export const updateUserSchema = z.object({
  name: displayNameSchema.optional(),
  avatarUrl: urlSchema.optional().nullable(),
});

/**
 * Change password schema.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: simplePasswordSchema,
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  });

/**
 * Refresh token schema.
 */
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * Forgot password schema.
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

/**
 * Reset password schema.
 */
export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * Verify email schema.
 */
export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

/**
 * Two-factor verification schema.
 */
export const twoFactorVerifySchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits').regex(/^\d+$/, 'Code must contain only digits'),
  isBackupCode: z.boolean().default(false),
});

/**
 * API key creation schema.
 */
export const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  scopes: z.array(z.string()).min(1, 'At least one scope is required'),
  expiresAt: z.string().datetime().optional().nullable(),
});

/**
 * Inferred types from schemas.
 */
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type TwoFactorVerifyInput = z.infer<typeof twoFactorVerifySchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
