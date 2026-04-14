/**
 * JwtStrategy Unit Tests
 *
 * Regression tests for the `/auth/me` flow.
 *
 * Context: A previous build injected a synthetic demo user into `request.user`
 * when a `DEMO_MODE` env var was set, which caused `GET /api/v1/auth/me` to
 * return 404 for freshly registered users because their real JWT was never
 * honored. These tests lock in the correct behavior of `JwtStrategy.validate`
 * so that the endpoint returns the real user for a valid token and rejects
 * invalid payloads deterministically.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';

import { JwtStrategy, JWT_AUDIENCE, JWT_ISSUER } from '../strategies/jwt.strategy';

const mockUser = {
  id: '660e8400-e29b-41d4-a716-446655440001',
  email: 'audit-me@willianpinho.com',
  name: 'Audit Me',
  avatarUrl: null,
  provider: 'EMAIL',
  providerId: null,
  password: '$2a$12$hashedpassword',
  preferences: {},
  createdAt: new Date('2026-04-14'),
  updatedAt: new Date('2026-04-14'),
};

const createMockUsersService = () => ({
  findById: vi.fn(),
});

const createMockConfigService = () => ({
  get: vi.fn((key: string) => (key === 'JWT_SECRET' ? 'test-jwt-secret' : undefined)),
});

describe('JwtStrategy', () => {
  let usersService: ReturnType<typeof createMockUsersService>;
  let configService: ReturnType<typeof createMockConfigService>;
  let strategy: JwtStrategy;

  beforeEach(() => {
    usersService = createMockUsersService();
    configService = createMockConfigService();
    strategy = new JwtStrategy(
      usersService as unknown as Parameters<typeof JwtStrategy>[0] extends never
        ? never
        : ConstructorParameters<typeof JwtStrategy>[0],
      configService as unknown as ConstructorParameters<typeof JwtStrategy>[1],
    );
  });

  describe('constructor', () => {
    it('throws when JWT_SECRET is missing', () => {
      const emptyConfig = { get: vi.fn(() => undefined) };
      expect(
        () =>
          new JwtStrategy(
            usersService as unknown as ConstructorParameters<typeof JwtStrategy>[0],
            emptyConfig as unknown as ConstructorParameters<typeof JwtStrategy>[1],
          ),
      ).toThrow('JWT_SECRET environment variable is not defined');
    });

    it('exposes JWT issuer and audience constants used by signing', () => {
      expect(JWT_ISSUER).toBe('dms-api');
      expect(JWT_AUDIENCE).toBe('dms-client');
    });
  });

  describe('validate', () => {
    it('returns the authenticated user for a valid payload', async () => {
      usersService.findById.mockResolvedValue(mockUser);

      const result = await strategy.validate({
        sub: mockUser.id,
        email: mockUser.email,
      });

      expect(usersService.findById).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual({ id: mockUser.id, email: mockUser.email });
    });

    it('throws UnauthorizedException when the payload has no sub', async () => {
      await expect(
        strategy.validate({
          sub: '',
          email: 'whatever@example.com',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(usersService.findById).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the user no longer exists', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(
        strategy.validate({
          sub: 'deleted-user-id',
          email: 'ghost@example.com',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
