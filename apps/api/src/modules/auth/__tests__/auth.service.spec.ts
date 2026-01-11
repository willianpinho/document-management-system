/**
 * AuthService Unit Tests
 *
 * Tests for authentication operations including registration, login,
 * token refresh, logout, and password validation.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import {
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

// Mock bcrypt module
vi.mock('bcryptjs', () => ({
  hash: vi.fn(),
  compare: vi.fn(),
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

// Import bcrypt after mocking
import * as bcrypt from 'bcryptjs';

// Mock PrismaService
const createMockPrismaService = () => ({
  refreshToken: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
  organization: {
    create: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
});

// Mock UsersService
const createMockUsersService = () => ({
  create: vi.fn(),
  findById: vi.fn(),
  findByEmail: vi.fn(),
});

// Mock JwtService
const createMockJwtService = () => ({
  sign: vi.fn(),
  verify: vi.fn(),
  decode: vi.fn(),
});

// Mock ConfigService
const createMockConfigService = () => ({
  get: vi.fn((key: string, defaultValue?: string) => {
    const config: Record<string, string> = {
      REFRESH_TOKEN_SECRET: 'refresh-secret-key',
      REFRESH_TOKEN_EXPIRES_IN: '7d',
      JWT_SECRET: 'jwt-secret-key',
    };
    return config[key] || defaultValue;
  }),
});

// Mock EmailService
const createMockEmailService = () => ({
  sendPasswordResetEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
  sendWelcomeEmail: vi.fn(),
});

// Test fixtures
const mockUserId = '660e8400-e29b-41d4-a716-446655440001';

const mockUser = {
  id: mockUserId,
  email: 'test@example.com',
  password: '$2a$12$hashedpassword',
  name: 'Test User',
  avatarUrl: null,
  provider: 'EMAIL',
  providerId: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

const mockSanitizedUser = {
  id: mockUserId,
  email: 'test@example.com',
  name: 'Test User',
  avatarUrl: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

// Import AuthService after setting up mocks
// We need to dynamically import it to avoid issues with module resolution
describe('AuthService', () => {
  let AuthService: any;
  let service: any;
  let prismaService: ReturnType<typeof createMockPrismaService>;
  let usersService: ReturnType<typeof createMockUsersService>;
  let jwtService: ReturnType<typeof createMockJwtService>;
  let configService: ReturnType<typeof createMockConfigService>;
  let emailService: ReturnType<typeof createMockEmailService>;

  beforeEach(async () => {
    // Reset modules to ensure fresh imports
    vi.resetModules();

    // Mock @prisma/client
    vi.doMock('@prisma/client', () => ({
      PrismaClient: vi.fn().mockImplementation(() => ({})),
      AuthProvider: {
        EMAIL: 'EMAIL',
        GOOGLE: 'GOOGLE',
        MICROSOFT: 'MICROSOFT',
      },
      MemberRole: {
        OWNER: 'OWNER',
        ADMIN: 'ADMIN',
        EDITOR: 'EDITOR',
        VIEWER: 'VIEWER',
      },
      Prisma: {},
    }));

    // Create fresh mocks for each test
    prismaService = createMockPrismaService();
    usersService = createMockUsersService();
    jwtService = createMockJwtService();
    configService = createMockConfigService();
    emailService = createMockEmailService();

    // Dynamically import AuthService after mocks are set up
    const authModule = await import('../auth.service');
    AuthService = authModule.AuthService;

    // Create service instance with mocks using Object.create to set up proper prototype chain
    service = Object.create(AuthService.prototype);

    // Manually inject dependencies
    Object.defineProperty(service, 'prisma', { value: prismaService, writable: true });
    Object.defineProperty(service, 'usersService', { value: usersService, writable: true });
    Object.defineProperty(service, 'jwtService', { value: jwtService, writable: true });
    Object.defineProperty(service, 'configService', { value: configService, writable: true });
    Object.defineProperty(service, 'emailService', { value: emailService, writable: true });
    Object.defineProperty(service, 'logger', {
      value: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      writable: true
    });
  });

  describe('register', () => {
    const registerDto = {
      email: 'newuser@example.com',
      password: 'SecurePass123!',
      name: 'New User',
    };

    it('should register new user and return tokens', async () => {
      const hashedPassword = '$2a$12$newhashedpassword';
      const newUser = { ...mockUser, email: registerDto.email, name: registerDto.name };

      usersService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as Mock).mockResolvedValue(hashedPassword);
      usersService.create.mockResolvedValue(newUser);
      prismaService.organization.create.mockResolvedValue({});
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      prismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn');
      expect(result.user.email).toBe(registerDto.email);
    });

    it('should hash password before storing', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as Mock).mockResolvedValue('hashed');
      usersService.create.mockResolvedValue(mockUser);
      prismaService.organization.create.mockResolvedValue({});
      jwtService.sign.mockReturnValue('token');
      prismaService.refreshToken.create.mockResolvedValue({});

      await service.register(registerDto);

      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'hashed',
        }),
      );
    });

    it('should throw ConflictException when email already exists', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );

      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('should store refresh token hash in database', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as Mock).mockResolvedValue('hashed');
      usersService.create.mockResolvedValue(mockUser);
      prismaService.organization.create.mockResolvedValue({});
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      prismaService.refreshToken.create.mockResolvedValue({});

      await service.register(registerDto);

      expect(prismaService.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('should not include password in returned user object', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as Mock).mockResolvedValue('hashed');
      usersService.create.mockResolvedValue(mockUser);
      prismaService.organization.create.mockResolvedValue({});
      jwtService.sign.mockReturnValue('token');
      prismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.register(registerDto);

      expect(result.user).not.toHaveProperty('password');
    });
  });

  describe('validateUser', () => {
    beforeEach(() => {
      // Reset bcrypt mocks for validateUser tests
      vi.mocked(bcrypt.compare).mockReset();
    });

    it('should return sanitized user on valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password');

      expect(result).toEqual(mockSanitizedUser);
      expect(result).not.toHaveProperty('password');
    });

    it('should return null when user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent@example.com', 'password');

      expect(result).toBeNull();
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should return null when password is invalid', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as Mock).mockResolvedValue(false);

      const result = await service.validateUser('test@example.com', 'wrongpassword');

      expect(result).toBeNull();
    });

    it('should return null when user has no password (OAuth user)', async () => {
      const oauthUser = { ...mockUser, password: null };
      usersService.findByEmail.mockResolvedValue(oauthUser);

      const result = await service.validateUser('test@example.com', 'password');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return tokens for valid user', async () => {
      usersService.findById.mockResolvedValue(mockUser);
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      prismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.login({ id: mockUserId });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken', 'access-token');
      expect(result).toHaveProperty('refreshToken', 'refresh-token');
      expect(result).toHaveProperty('expiresIn', 900);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.login({ id: 'non-existent' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should generate JWT with correct payload', async () => {
      usersService.findById.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('token');
      prismaService.refreshToken.create.mockResolvedValue({});

      await service.login({ id: mockUserId });

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUserId,
          email: mockUser.email,
        }),
      );
    });

    it('should create refresh token with 7 day expiration', async () => {
      usersService.findById.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('token');
      prismaService.refreshToken.create.mockResolvedValue({});

      await service.login({ id: mockUserId });

      const createCall = prismaService.refreshToken.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt as Date;
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Allow 1 minute tolerance
      expect(Math.abs(expiresAt.getTime() - sevenDaysFromNow.getTime())).toBeLessThan(
        60 * 1000,
      );
    });
  });

  describe('refreshToken', () => {
    const validRefreshToken = 'valid-refresh-token';

    beforeEach(() => {
      jwtService.verify.mockReturnValue({
        sub: mockUserId,
        email: mockUser.email,
        jti: 'token-id',
      });
    });

    it('should return new tokens for valid refresh token', async () => {
      prismaService.refreshToken.findFirst.mockResolvedValue({
        id: 'token-record-id',
        tokenHash: 'hash',
        userId: mockUserId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
      });
      prismaService.refreshToken.update.mockResolvedValue({});
      usersService.findById.mockResolvedValue(mockUser);
      jwtService.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');
      prismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.refreshToken(validRefreshToken);

      expect(result).toHaveProperty('accessToken', 'new-access-token');
      expect(result).toHaveProperty('refreshToken', 'new-refresh-token');
      expect(result).toHaveProperty('user');
    });

    it('should revoke old refresh token (token rotation)', async () => {
      const tokenRecordId = 'token-record-id';
      prismaService.refreshToken.findFirst.mockResolvedValue({
        id: tokenRecordId,
        tokenHash: 'hash',
        userId: mockUserId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
      });
      prismaService.refreshToken.update.mockResolvedValue({});
      usersService.findById.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('token');
      prismaService.refreshToken.create.mockResolvedValue({});

      await service.refreshToken(validRefreshToken);

      expect(prismaService.refreshToken.update).toHaveBeenCalledWith({
        where: { id: tokenRecordId },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for revoked token', async () => {
      prismaService.refreshToken.findFirst.mockResolvedValue(null);

      await expect(service.refreshToken(validRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for expired token', async () => {
      prismaService.refreshToken.findFirst.mockResolvedValue(null);

      await expect(service.refreshToken(validRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      prismaService.refreshToken.findFirst.mockResolvedValue({
        id: 'token-id',
        userId: mockUserId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
      });
      prismaService.refreshToken.update.mockResolvedValue({});
      usersService.findById.mockResolvedValue(null);

      await expect(service.refreshToken(validRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should verify token with correct secret', async () => {
      prismaService.refreshToken.findFirst.mockResolvedValue({
        id: 'token-id',
        userId: mockUserId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
      });
      prismaService.refreshToken.update.mockResolvedValue({});
      usersService.findById.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('token');
      prismaService.refreshToken.create.mockResolvedValue({});

      await service.refreshToken(validRefreshToken);

      expect(jwtService.verify).toHaveBeenCalledWith(validRefreshToken, {
        secret: 'refresh-secret-key',
      });
    });
  });

  describe('logout', () => {
    it('should revoke specific refresh token when provided', async () => {
      prismaService.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.logout(mockUserId, 'refresh-token');

      expect(result).toEqual({ success: true });
      expect(prismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          tokenHash: expect.any(String),
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should revoke all refresh tokens when no token provided', async () => {
      prismaService.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.logout(mockUserId);

      expect(result).toEqual({ success: true });
      expect(prismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should not throw when no tokens to revoke', async () => {
      prismaService.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.logout(mockUserId);

      expect(result).toEqual({ success: true });
    });
  });

  describe('getProfile', () => {
    it('should return sanitized user profile', async () => {
      usersService.findById.mockResolvedValue(mockUser);

      const result = await service.getProfile(mockUserId);

      expect(result).toEqual(mockSanitizedUser);
      expect(result).not.toHaveProperty('password');
    });

    it('should throw NotFoundException when user not found', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.getProfile('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('token generation', () => {
    it('should generate access token with 15 minute expiration', async () => {
      usersService.findById.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('token');
      prismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.login({ id: mockUserId });

      expect(result.expiresIn).toBe(900); // 15 minutes in seconds
    });

    it('should include jti in refresh token for revocation', async () => {
      usersService.findById.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('token');
      prismaService.refreshToken.create.mockResolvedValue({});

      await service.login({ id: mockUserId });

      // Second call is for refresh token
      const refreshTokenCall = jwtService.sign.mock.calls[1];
      expect(refreshTokenCall[0]).toHaveProperty('jti');
    });

    it('should use separate secret for refresh token', async () => {
      usersService.findById.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('token');
      prismaService.refreshToken.create.mockResolvedValue({});

      await service.login({ id: mockUserId });

      // Second call is for refresh token
      const refreshTokenOptions = jwtService.sign.mock.calls[1][1];
      expect(refreshTokenOptions).toHaveProperty('secret', 'refresh-secret-key');
    });
  });

  describe('password hashing', () => {
    it('should use bcrypt with cost factor 12', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as Mock).mockResolvedValue('hashed');
      usersService.create.mockResolvedValue(mockUser);
      prismaService.organization.create.mockResolvedValue({});
      jwtService.sign.mockReturnValue('token');
      prismaService.refreshToken.create.mockResolvedValue({});

      await service.register({
        email: 'new@example.com',
        password: 'password',
        name: 'Test',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('password', 12);
    });

    it('should use bcrypt compare for password validation', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as Mock).mockResolvedValue(true);

      await service.validateUser('test@example.com', 'password');

      expect(bcrypt.compare).toHaveBeenCalledWith('password', mockUser.password);
    });
  });
});
