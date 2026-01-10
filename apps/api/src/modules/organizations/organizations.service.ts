import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';

import { PrismaService } from '@/common/prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new organization with the creator as OWNER
   */
  async create(dto: CreateOrganizationDto, creatorId: string) {
    const slug = dto.slug || this.generateSlug(dto.name);

    // Check if slug is already taken
    const existing = await this.prisma.organization.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new ConflictException('An organization with this slug already exists');
    }

    const organization = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug,
        settings: (dto.settings || {}) as any,
        members: {
          create: {
            userId: creatorId,
            role: 'OWNER',
            joinedAt: new Date(),
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, name: true, avatarUrl: true },
            },
          },
        },
      },
    });

    this.logger.log(`Organization created: ${organization.id} by user ${creatorId}`);
    return organization;
  }

  /**
   * Find organization by ID
   */
  async findById(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, name: true, avatarUrl: true },
            },
          },
        },
        _count: {
          select: {
            documents: true,
            folders: true,
          },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  /**
   * Find organization by slug
   */
  async findBySlug(slug: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { slug },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  /**
   * Get all organizations for a user
   */
  async findByUserId(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: {
          include: {
            _count: {
              select: {
                documents: true,
                members: true,
              },
            },
          },
        },
      },
    });

    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      plan: m.organization.plan,
      storageQuotaBytes: Number(m.organization.storageQuotaBytes),
      storageUsedBytes: Number(m.organization.storageUsedBytes),
      settings: m.organization.settings,
      createdAt: m.organization.createdAt,
      updatedAt: m.organization.updatedAt,
      documentCount: m.organization._count.documents,
      memberCount: m.organization._count.members,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  /**
   * Update organization
   */
  async update(id: string, dto: UpdateOrganizationDto) {
    await this.findById(id);

    return this.prisma.organization.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.settings && { settings: dto.settings as any }),
      },
    });
  }

  /**
   * Delete organization (only by OWNER)
   */
  async delete(id: string) {
    await this.findById(id);

    await this.prisma.organization.delete({
      where: { id },
    });

    this.logger.log(`Organization deleted: ${id}`);
    return { success: true };
  }

  /**
   * Get storage usage for organization
   */
  async getStorageUsage(id: string) {
    const organization = await this.findById(id);

    const usage = await this.prisma.document.aggregate({
      where: {
        organizationId: id,
        status: { not: 'DELETED' },
      },
      _sum: {
        sizeBytes: true,
      },
    });

    return {
      usedBytes: Number(usage._sum.sizeBytes || 0),
      quotaBytes: Number(organization.storageQuotaBytes),
      usagePercent: organization.storageQuotaBytes
        ? Math.round(
            (Number(usage._sum.sizeBytes || 0) / Number(organization.storageQuotaBytes)) * 100,
          )
        : 0,
    };
  }

  /**
   * Invite a member to the organization
   */
  async inviteMember(organizationId: string, email: string, role: string) {
    const organization = await this.findById(organizationId);

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // In production, you'd send an invitation email here
      throw new NotFoundException('User with this email not found. Invite feature coming soon.');
    }

    // Check if user is already a member
    const existingMembership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: user.id,
        },
      },
    });

    if (existingMembership) {
      throw new ConflictException('User is already a member of this organization');
    }

    const membership = await this.prisma.organizationMember.create({
      data: {
        organizationId,
        userId: user.id,
        role: role as 'VIEWER' | 'EDITOR' | 'ADMIN',
        joinedAt: new Date(),
      },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
    });

    this.logger.log(`Member ${user.id} added to organization ${organizationId}`);
    return membership;
  }

  /**
   * Remove a member from the organization
   */
  async removeMember(organizationId: string, memberId: string, requesterId: string) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: memberId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Member not found in this organization');
    }

    // Cannot remove the owner
    if (membership.role === 'OWNER') {
      throw new ForbiddenException('Cannot remove the organization owner');
    }

    // Cannot remove yourself (use leave instead)
    if (memberId === requesterId) {
      throw new BadRequestException('Use the leave endpoint to leave an organization');
    }

    await this.prisma.organizationMember.delete({
      where: {
        organizationId_userId: {
          organizationId,
          userId: memberId,
        },
      },
    });

    this.logger.log(`Member ${memberId} removed from organization ${organizationId}`);
    return { success: true };
  }

  /**
   * Update a member's role
   */
  async updateMemberRole(
    organizationId: string,
    memberId: string,
    newRole: string,
    requesterId: string,
  ) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: memberId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Member not found in this organization');
    }

    // Cannot change owner's role
    if (membership.role === 'OWNER' && newRole !== 'OWNER') {
      throw new ForbiddenException('Cannot change the owner role. Transfer ownership instead.');
    }

    // Only owner can assign owner role
    if (newRole === 'OWNER') {
      const requesterMembership = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: requesterId,
          },
        },
      });

      if (requesterMembership?.role !== 'OWNER') {
        throw new ForbiddenException('Only the owner can transfer ownership');
      }

      // Transfer ownership: demote current owner to admin
      await this.prisma.organizationMember.update({
        where: {
          organizationId_userId: {
            organizationId,
            userId: requesterId,
          },
        },
        data: { role: 'ADMIN' },
      });
    }

    const updated = await this.prisma.organizationMember.update({
      where: {
        organizationId_userId: {
          organizationId,
          userId: memberId,
        },
      },
      data: { role: newRole as 'VIEWER' | 'EDITOR' | 'ADMIN' | 'OWNER' },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
    });

    this.logger.log(`Member ${memberId} role updated to ${newRole} in organization ${organizationId}`);
    return updated;
  }

  /**
   * Leave an organization
   */
  async leaveOrganization(organizationId: string, userId: string) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('You are not a member of this organization');
    }

    if (membership.role === 'OWNER') {
      throw new ForbiddenException(
        'Owner cannot leave. Transfer ownership first or delete the organization.',
      );
    }

    await this.prisma.organizationMember.delete({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    this.logger.log(`User ${userId} left organization ${organizationId}`);
    return { success: true };
  }

  /**
   * Get organization members
   */
  async getMembers(organizationId: string) {
    await this.findById(organizationId);

    return this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
  }

  /**
   * Generate URL-friendly slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100);
  }

  // =============================================================================
  // API KEYS MANAGEMENT
  // =============================================================================

  /**
   * Get all API keys for an organization
   */
  async getApiKeys(organizationId: string) {
    await this.findById(organizationId);

    const apiKeys = await this.prisma.apiKey.findMany({
      where: {
        organizationId,
        revokedAt: null,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiKeys;
  }

  /**
   * Create a new API key
   */
  async createApiKey(
    organizationId: string,
    name: string,
    scopes: string[] = [],
    expiresAt?: Date,
  ) {
    await this.findById(organizationId);

    // Generate a secure API key
    const keyPrefix = `dms_${crypto.randomBytes(4).toString('hex')}`;
    const keySuffix = crypto.randomBytes(24).toString('hex');
    const fullKey = `${keyPrefix}_${keySuffix}`;
    const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');

    const apiKey = await this.prisma.apiKey.create({
      data: {
        organizationId,
        name,
        keyPrefix,
        keyHash,
        scopes,
        expiresAt,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    this.logger.log(`API key created: ${apiKey.id} for organization ${organizationId}`);

    // Return the full key only on creation (it cannot be retrieved later)
    return {
      ...apiKey,
      key: fullKey,
      message: 'Save this key securely. It cannot be retrieved again.',
    };
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(organizationId: string, keyId: string) {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        id: keyId,
        organizationId,
        revokedAt: null,
      },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`API key revoked: ${keyId} for organization ${organizationId}`);
    return { success: true, message: 'API key revoked successfully' };
  }

  /**
   * Validate an API key and return organization info
   */
  async validateApiKey(key: string) {
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');

    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        keyHash,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
          },
        },
      },
    });

    if (!apiKey) {
      return null;
    }

    // Update last used timestamp
    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      keyId: apiKey.id,
      organizationId: apiKey.organizationId,
      organization: apiKey.organization,
      scopes: apiKey.scopes,
    };
  }
}
