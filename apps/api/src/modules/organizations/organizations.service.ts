import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';

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
}
