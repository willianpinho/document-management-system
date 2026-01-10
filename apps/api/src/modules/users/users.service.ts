import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { AuthProvider, Prisma } from '@prisma/client';

import { PrismaService } from '@/common/prisma/prisma.service';
import {
  UserPreferencesDto,
  defaultUserPreferences,
} from './dto/user-preferences.dto';

interface CreateUserInput {
  email: string;
  password?: string;
  name?: string;
  avatarUrl?: string;
  provider?: AuthProvider;
  providerId?: string;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateUserInput) {
    return this.prisma.user.create({
      data: {
        email: input.email,
        password: input.password,
        name: input.name,
        avatarUrl: input.avatarUrl,
        provider: input.provider,
        providerId: input.providerId,
        preferences: defaultUserPreferences as Prisma.InputJsonValue,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async update(id: string, data: Partial<CreateUserInput>) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async getPreferences(userId: string): Promise<UserPreferencesDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Merge with defaults to ensure all fields exist
    const userPrefs = (user.preferences as UserPreferencesDto) || {};
    return {
      notifications: {
        ...defaultUserPreferences.notifications,
        ...userPrefs.notifications,
      },
      appearance: {
        ...defaultUserPreferences.appearance,
        ...userPrefs.appearance,
      },
    };
  }

  async updatePreferences(
    userId: string,
    preferences: UserPreferencesDto,
  ): Promise<UserPreferencesDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Deep merge with existing preferences
    const currentPrefs = (user.preferences as UserPreferencesDto) || {};
    const mergedPrefs: UserPreferencesDto = {
      notifications: {
        ...defaultUserPreferences.notifications,
        ...currentPrefs.notifications,
        ...preferences.notifications,
      },
      appearance: {
        ...defaultUserPreferences.appearance,
        ...currentPrefs.appearance,
        ...preferences.appearance,
      },
    };

    await this.prisma.user.update({
      where: { id: userId },
      data: { preferences: mergedPrefs as Prisma.InputJsonValue },
    });

    return mergedPrefs;
  }

  async exportUserData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
        preferences: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get user's organization memberships
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      select: {
        role: true,
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Get documents created by user
    const documents = await this.prisma.document.findMany({
      where: { createdById: userId },
      select: {
        id: true,
        name: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
      },
      take: 1000,
    });

    // Get folders created by user
    const folders = await this.prisma.folder.findMany({
      where: { createdById: userId },
      select: {
        id: true,
        name: true,
        path: true,
        createdAt: true,
      },
      take: 1000,
    });

    this.logger.log(`Data export requested for user: ${userId}`);

    return {
      profile: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      preferences: user.preferences,
      organizations: memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        role: m.role,
      })),
      documents: documents.map((d) => ({
        id: d.id,
        name: d.name,
        mimeType: d.mimeType,
        sizeBytes: Number(d.sizeBytes),
        createdAt: d.createdAt.toISOString(),
      })),
      folders: folders.map((f) => ({
        id: f.id,
        name: f.name,
        path: f.path,
        createdAt: f.createdAt.toISOString(),
      })),
      exportedAt: new Date().toISOString(),
    };
  }

  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete in order to respect foreign key constraints
    // 1. Delete refresh tokens
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    // 2. Delete organization memberships (user will be removed from orgs)
    await this.prisma.organizationMember.deleteMany({
      where: { userId },
    });

    // 3. Delete the user (cascade will handle related records if configured)
    await this.prisma.user.delete({
      where: { id: userId },
    });

    this.logger.log(`Account deleted for user: ${userId}`);

    return { success: true, message: 'Account deleted successfully' };
  }
}
