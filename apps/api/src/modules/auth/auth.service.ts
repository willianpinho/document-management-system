import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import { PrismaService } from '@/common/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { RegisterDto } from './dto/register.dto';

export interface TokenPayload {
  sub: string;
  email: string;
  jti?: string;
}

export interface SanitizedUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Register a new user
   */
  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 12);
    const user = await this.usersService.create({
      email: registerDto.email,
      password: hashedPassword,
      name: registerDto.name,
    });

    // Create a default personal organization for the new user
    const orgSlug = this.generateOrgSlug(registerDto.name || registerDto.email);
    await this.prisma.organization.create({
      data: {
        name: `${registerDto.name || 'My'}'s Workspace`,
        slug: orgSlug,
        plan: 'FREE',
        storageQuotaBytes: BigInt(5368709120), // 5GB
        storageUsedBytes: BigInt(0),
        members: {
          create: {
            userId: user.id,
            role: 'OWNER',
            joinedAt: new Date(),
          },
        },
      },
    });

    const tokens = await this.generateTokens(user.id, user.email);

    this.logger.log(`User registered: ${user.email}`);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  /**
   * Generate a unique slug for organization
   */
  private generateOrgSlug(baseName: string): string {
    const cleanName = baseName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);
    const uniqueSuffix = crypto.randomBytes(4).toString('hex');
    return `${cleanName}-${uniqueSuffix}`;
  }

  /**
   * Validate user credentials
   */
  async validateUser(email: string, password: string): Promise<SanitizedUser | null> {
    const user = await this.usersService.findByEmail(email);

    if (!user || !user.password) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    return this.sanitizeUser(user);
  }

  /**
   * Login user and return tokens
   */
  async login(user: { id: string }) {
    const fullUser = await this.usersService.findById(user.id);
    if (!fullUser) {
      throw new UnauthorizedException('User not found');
    }

    const tokens = await this.generateTokens(fullUser.id, fullUser.email);

    this.logger.log(`User logged in: ${fullUser.email}`);

    return {
      user: this.sanitizeUser(fullUser),
      ...tokens,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<TokenPayload>(refreshToken, {
        secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
      });

      // Verify refresh token exists in database
      const tokenHash = this.hashToken(refreshToken);
      const storedToken = await this.prisma.refreshToken.findFirst({
        where: {
          tokenHash,
          userId: payload.sub,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      if (!storedToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Revoke old refresh token (rotation)
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const tokens = await this.generateTokens(user.id, user.email);

      return {
        user: this.sanitizeUser(user),
        ...tokens,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.warn(`Invalid refresh token attempt`);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Logout user and revoke refresh token
   */
  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: {
          userId,
          tokenHash,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    } else {
      // Revoke all refresh tokens for user
      await this.prisma.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }

    this.logger.log(`User logged out: ${userId}`);
    return { success: true };
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.sanitizeUser(user);
  }

  /**
   * Get all active sessions for a user
   */
  async getSessions(userId: string) {
    const sessions = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        deviceId: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return sessions.map((session, index) => ({
      id: session.id,
      device: session.deviceId || `Session ${index + 1}`,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      current: index === 0, // Most recent is likely current
    }));
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.refreshToken.findFirst({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.prisma.refreshToken.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`Session revoked: ${sessionId} for user: ${userId}`);
    return { success: true, message: 'Session revoked successfully' };
  }

  /**
   * Revoke all sessions except the current one
   */
  async revokeAllSessions(userId: string, currentTokenHash?: string) {
    const whereClause: { userId: string; revokedAt: null; tokenHash?: { not: string } } = {
      userId,
      revokedAt: null,
    };

    if (currentTokenHash) {
      whereClause.tokenHash = { not: currentTokenHash };
    }

    const result = await this.prisma.refreshToken.updateMany({
      where: whereClause,
      data: { revokedAt: new Date() },
    });

    this.logger.log(`Revoked ${result.count} sessions for user: ${userId}`);
    return { success: true, message: `Revoked ${result.count} sessions` };
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.password) {
      throw new BadRequestException(
        'Cannot change password for OAuth accounts. Use your OAuth provider to manage credentials.',
      );
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Revoke all refresh tokens for security
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`Password changed for user: ${userId}`);
    return { success: true, message: 'Password changed successfully' };
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(userId: string, email: string) {
    const jti = crypto.randomUUID();
    const payload: TokenPayload = { sub: userId, email };

    const accessToken = this.jwtService.sign(payload);

    const refreshTokenExpiresIn = this.configService.get<string>(
      'REFRESH_TOKEN_EXPIRES_IN',
      '7d',
    ) as `${number}${'s' | 'm' | 'h' | 'd'}`;
    const refreshToken = this.jwtService.sign(
      { ...payload, jti },
      {
        secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
        expiresIn: refreshTokenExpiresIn,
      },
    );

    // Store refresh token hash in database
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  /**
   * Hash a token for storage
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Request a password reset (forgot password)
   */
  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);

    // Always return success to prevent email enumeration
    if (!user) {
      this.logger.warn(`Password reset requested for non-existent email: ${email}`);
      return {
        success: true,
        message: 'If an account exists with this email, a password reset link will be sent.',
      };
    }

    // Check if user has password (not OAuth-only)
    if (!user.password) {
      this.logger.warn(`Password reset requested for OAuth account: ${email}`);
      return {
        success: true,
        message: 'If an account exists with this email, a password reset link will be sent.',
      };
    }

    // Generate password reset token (JWT with short expiry)
    const resetToken = this.jwtService.sign(
      { sub: user.id, email: user.email, type: 'password_reset' },
      {
        secret: this.configService.get<string>('JWT_SECRET') + user.password, // Include password hash for single-use
        expiresIn: '1h',
      },
    );

    // Send password reset email
    try {
      await this.emailService.sendPasswordResetEmail(user.email, resetToken, user.name);
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      // Log the error but don't expose it to the user (security)
      this.logger.error(`Failed to send password reset email to ${email}:`, error);
    }

    return {
      success: true,
      message: 'If an account exists with this email, a password reset link will be sent.',
    };
  }

  /**
   * Reset password using a valid reset token
   */
  async resetPassword(token: string, newPassword: string) {
    try {
      // First, decode without verification to get user ID
      const decoded = this.jwtService.decode(token) as TokenPayload & { type?: string };

      if (!decoded || !decoded.sub || decoded.type !== 'password_reset') {
        throw new BadRequestException('Invalid reset token');
      }

      // Get user to retrieve password hash for verification
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub },
        select: { id: true, email: true, password: true },
      });

      if (!user || !user.password) {
        throw new BadRequestException('Invalid reset token');
      }

      // Verify token with user's current password hash
      // This ensures token becomes invalid after password change (single-use)
      try {
        this.jwtService.verify(token, {
          secret: this.configService.get<string>('JWT_SECRET') + user.password,
        });
      } catch {
        throw new BadRequestException('Invalid or expired reset token');
      }

      // Update password
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      // Revoke all refresh tokens for security
      await this.prisma.refreshToken.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      this.logger.log(`Password reset completed for user: ${user.email}`);

      return {
        success: true,
        message: 'Password has been reset successfully. Please log in with your new password.',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.warn(`Invalid password reset attempt`);
      throw new BadRequestException('Invalid or expired reset token');
    }
  }

  /**
   * Remove sensitive data from user object
   */
  private sanitizeUser(user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): SanitizedUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
