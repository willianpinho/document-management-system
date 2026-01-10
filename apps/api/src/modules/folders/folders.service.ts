import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { DocumentStatus, SharePermission } from '@prisma/client';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '@/common/prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { FolderEventData, EventUser } from '../realtime/dto/realtime-events.dto';

interface CreateFolderInput {
  name: string;
  parentId?: string;
  organizationId: string;
  createdById: string;
}

interface UpdateFolderInput {
  name?: string;
  parentId?: string | null;
}

@Injectable()
export class FoldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  /**
   * Convert a Prisma folder to event data format
   */
  private toEventData(folder: {
    id: string;
    name: string;
    path: string;
    parentId: string | null;
    createdAt: Date;
    updatedAt: Date;
    createdBy?: { id: string; name: string | null; email: string } | null;
  }): FolderEventData {
    return {
      id: folder.id,
      name: folder.name,
      path: folder.path,
      parentId: folder.parentId,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString(),
      createdBy: folder.createdBy
        ? {
            id: folder.createdBy.id,
            name: folder.createdBy.name,
            email: folder.createdBy.email,
          }
        : undefined,
    };
  }

  async create(input: CreateFolderInput, triggeredBy?: EventUser) {
    let path = `/${input.name}`;

    if (input.parentId) {
      const parent = await this.prisma.folder.findFirst({
        where: { id: input.parentId, organizationId: input.organizationId },
      });
      if (!parent) {
        throw new NotFoundException('Parent folder not found');
      }
      path = `${parent.path}/${input.name}`;
    }

    const folder = await this.prisma.folder.create({
      data: {
        name: input.name,
        path,
        organizationId: input.organizationId,
        parentId: input.parentId,
        createdById: input.createdById,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Emit real-time event
    if (triggeredBy) {
      this.realtimeService.emitFolderCreated(
        this.toEventData(folder),
        input.organizationId,
        triggeredBy,
      );
    }

    return folder;
  }

  async findAll(organizationId: string, parentId?: string) {
    return this.prisma.folder.findMany({
      where: {
        organizationId,
        parentId: parentId || null,
      },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            children: true,
            documents: true,
          },
        },
      },
    });
  }

  async findOne(id: string, organizationId: string) {
    const folder = await this.prisma.folder.findFirst({
      where: { id, organizationId },
      include: {
        parent: true,
        children: {
          orderBy: { name: 'asc' },
        },
        documents: {
          where: { status: { not: DocumentStatus.DELETED } },
          orderBy: { createdAt: 'desc' },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    return folder;
  }

  async update(
    id: string,
    organizationId: string,
    input: UpdateFolderInput,
    triggeredBy?: EventUser,
  ) {
    const existingFolder = await this.findOne(id, organizationId);

    // Track changes for event
    const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];

    let newPath = existingFolder.path;
    if (input.name && input.name !== existingFolder.name) {
      changes.push({ field: 'name', oldValue: existingFolder.name, newValue: input.name });
      const pathParts = existingFolder.path.split('/');
      pathParts[pathParts.length - 1] = input.name;
      newPath = pathParts.join('/');
    }

    if (input.parentId !== undefined && input.parentId !== existingFolder.parentId) {
      if (input.parentId === id) {
        throw new BadRequestException('Cannot move folder into itself');
      }

      changes.push({ field: 'parentId', oldValue: existingFolder.parentId, newValue: input.parentId });

      if (input.parentId) {
        const newParent = await this.prisma.folder.findFirst({
          where: { id: input.parentId, organizationId },
        });
        if (!newParent) {
          throw new NotFoundException('Target folder not found');
        }
        newPath = `${newParent.path}/${input.name || existingFolder.name}`;
      } else {
        newPath = `/${input.name || existingFolder.name}`;
      }
    }

    const folder = await this.prisma.folder.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.parentId !== undefined && { parentId: input.parentId }),
        path: newPath,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Emit real-time event
    if (triggeredBy && changes.length > 0) {
      this.realtimeService.emitFolderUpdated(
        this.toEventData(folder),
        organizationId,
        triggeredBy,
        changes,
      );
    }

    return folder;
  }

  async remove(id: string, organizationId: string, triggeredBy?: EventUser) {
    const folder = await this.findOne(id, organizationId);

    // Check if folder has contents
    const hasChildren = await this.prisma.folder.count({
      where: { parentId: id },
    });
    const hasDocuments = await this.prisma.document.count({
      where: { folderId: id, status: { not: DocumentStatus.DELETED } },
    });

    if (hasChildren > 0 || hasDocuments > 0) {
      throw new BadRequestException('Folder is not empty');
    }

    const deletedFolder = await this.prisma.folder.delete({
      where: { id },
    });

    // Emit real-time event
    if (triggeredBy) {
      this.realtimeService.emitFolderDeleted(
        folder.id,
        folder.name,
        folder.path,
        organizationId,
        triggeredBy,
      );
    }

    return deletedFolder;
  }

  async getTree(id: string, organizationId: string) {
    const folder = await this.findOne(id, organizationId);

    const buildTree = async (folderId: string): Promise<{
      id: string;
      name: string;
      path: string;
      children: unknown[];
    }> => {
      const f = await this.prisma.folder.findUnique({
        where: { id: folderId },
        include: {
          children: {
            orderBy: { name: 'asc' },
          },
        },
      });

      if (!f) {
        throw new NotFoundException('Folder not found');
      }

      return {
        id: f.id,
        name: f.name,
        path: f.path,
        children: await Promise.all(f.children.map((child) => buildTree(child.id))),
      };
    };

    return buildTree(folder.id);
  }

  async getFullTree(organizationId: string) {
    // Get all root folders (no parent)
    const rootFolders = await this.prisma.folder.findMany({
      where: {
        organizationId,
        parentId: null,
      },
      orderBy: { name: 'asc' },
    });

    const buildTree = async (folderId: string): Promise<{
      id: string;
      name: string;
      path: string;
      children: unknown[];
    }> => {
      const f = await this.prisma.folder.findUnique({
        where: { id: folderId },
        include: {
          children: {
            orderBy: { name: 'asc' },
          },
        },
      });

      if (!f) {
        return { id: folderId, name: '', path: '', children: [] };
      }

      return {
        id: f.id,
        name: f.name,
        path: f.path,
        children: await Promise.all(f.children.map((child) => buildTree(child.id))),
      };
    };

    const tree = await Promise.all(rootFolders.map((folder) => buildTree(folder.id)));
    return tree;
  }

  async getBreadcrumbs(id: string, organizationId: string) {
    const folder = await this.findOne(id, organizationId);
    const pathParts = folder.path.split('/').filter(Boolean);

    const breadcrumbs = [];
    let currentPath = '';

    for (const part of pathParts) {
      currentPath += `/${part}`;
      const f = await this.prisma.folder.findFirst({
        where: { path: currentPath, organizationId },
        select: { id: true, name: true, path: true },
      });
      if (f) {
        breadcrumbs.push(f);
      }
    }

    return breadcrumbs;
  }

  // ============================================
  // Folder Sharing Methods
  // ============================================

  /**
   * Get all shares for a folder
   */
  async getShares(folderId: string, organizationId: string) {
    await this.findOne(folderId, organizationId);

    // Get user shares
    const userShares = await this.prisma.documentShare.findMany({
      where: { folderId },
    });

    // Fetch user data for each share
    const users = await Promise.all(
      userShares.map(async (share) => {
        const user = await this.prisma.user.findUnique({
          where: { id: share.sharedWithId },
          select: { id: true, email: true, name: true, avatarUrl: true },
        });
        return {
          id: user?.id || share.sharedWithId,
          email: user?.email || '',
          name: user?.name,
          avatarUrl: user?.avatarUrl,
          permission: share.permission,
          canShare: false, // Not implemented in current schema
          sharedAt: share.createdAt.toISOString(),
        };
      })
    );

    // Get share link
    const shareLink = await this.prisma.shareLink.findFirst({
      where: { folderId },
    });

    const link = shareLink
      ? {
          id: shareLink.id,
          token: shareLink.token,
          permission: shareLink.permission,
          expiresAt: shareLink.expiresAt?.toISOString() || null,
          hasPassword: !!shareLink.password,
          maxUses: shareLink.maxDownloads,
          useCount: shareLink.downloadCount,
          createdAt: shareLink.createdAt.toISOString(),
        }
      : null;

    return { users, link };
  }

  /**
   * Share a folder with a user by email
   */
  async shareWithUser(
    folderId: string,
    organizationId: string,
    email: string,
    permission: SharePermission,
    sharedById: string,
    canShare?: boolean,
  ) {
    await this.findOne(folderId, organizationId);

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if already shared
    const existingShare = await this.prisma.documentShare.findFirst({
      where: { folderId, sharedWithId: user.id },
    });

    if (existingShare) {
      throw new ConflictException('Folder is already shared with this user');
    }

    // Create share
    const share = await this.prisma.documentShare.create({
      data: {
        folderId,
        sharedWithId: user.id,
        sharedById,
        permission,
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      permission: share.permission,
      canShare: canShare ?? false,
      sharedAt: share.createdAt.toISOString(),
    };
  }

  /**
   * Update share permission for a user
   */
  async updateShare(
    folderId: string,
    organizationId: string,
    userId: string,
    permission?: SharePermission,
    canShare?: boolean,
  ) {
    await this.findOne(folderId, organizationId);

    const share = await this.prisma.documentShare.findFirst({
      where: { folderId, sharedWithId: userId },
    });

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    // Build update data only with provided fields
    const updateData: { permission?: SharePermission } = {};
    if (permission !== undefined) {
      updateData.permission = permission;
    }

    const updatedShare = await this.prisma.documentShare.update({
      where: { id: share.id },
      data: updateData,
    });

    // Fetch user data
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });

    return {
      id: user?.id || userId,
      email: user?.email || '',
      name: user?.name,
      avatarUrl: user?.avatarUrl,
      permission: updatedShare.permission,
      canShare: canShare ?? false,
      sharedAt: updatedShare.createdAt.toISOString(),
    };
  }

  /**
   * Remove share for a user
   */
  async removeShare(folderId: string, organizationId: string, userId: string) {
    await this.findOne(folderId, organizationId);

    const share = await this.prisma.documentShare.findFirst({
      where: { folderId, sharedWithId: userId },
    });

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    await this.prisma.documentShare.delete({
      where: { id: share.id },
    });

    return { success: true };
  }

  /**
   * Create a share link for the folder
   */
  async createShareLink(
    folderId: string,
    organizationId: string,
    permission: SharePermission,
    createdById: string,
    expiresAt?: Date,
    password?: string,
    maxUses?: number,
  ) {
    await this.findOne(folderId, organizationId);

    // Delete existing link
    await this.prisma.shareLink.deleteMany({
      where: { folderId },
    });

    // Generate token
    const token = randomBytes(32).toString('hex');

    // Hash password if provided
    let hashedPassword: string | null = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const link = await this.prisma.shareLink.create({
      data: {
        folderId,
        token,
        permission,
        password: hashedPassword,
        expiresAt,
        maxDownloads: maxUses,
        createdById,
      },
    });

    return {
      id: link.id,
      token: link.token,
      permission: link.permission,
      expiresAt: link.expiresAt?.toISOString() || null,
      hasPassword: !!link.password,
      maxUses: link.maxDownloads,
      useCount: link.downloadCount,
      createdAt: link.createdAt.toISOString(),
    };
  }

  /**
   * Delete share link for the folder
   */
  async deleteShareLink(folderId: string, organizationId: string) {
    await this.findOne(folderId, organizationId);

    await this.prisma.shareLink.deleteMany({
      where: { folderId },
    });

    return { success: true };
  }

  /**
   * Access folder by share link token
   */
  async accessByShareLink(token: string, password?: string) {
    const link = await this.prisma.shareLink.findUnique({
      where: { token },
    });

    if (!link || !link.folderId) {
      throw new NotFoundException('Share link not found');
    }

    // Check expiration
    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new BadRequestException('Share link has expired');
    }

    // Check max uses
    if (link.maxDownloads && link.downloadCount >= link.maxDownloads) {
      throw new BadRequestException('Share link has reached maximum uses');
    }

    // Check password
    if (link.password) {
      if (!password) {
        throw new BadRequestException('Password required');
      }
      const valid = await bcrypt.compare(password, link.password);
      if (!valid) {
        throw new BadRequestException('Invalid password');
      }
    }

    // Increment use count
    await this.prisma.shareLink.update({
      where: { id: link.id },
      data: { downloadCount: { increment: 1 } },
    });

    // Get folder
    const folder = await this.prisma.folder.findUnique({
      where: { id: link.folderId },
      include: {
        children: { orderBy: { name: 'asc' } },
        documents: {
          where: { status: { not: DocumentStatus.DELETED } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return {
      folder,
      permission: link.permission,
    };
  }

  /**
   * Get inherited shares (from parent folders)
   */
  async getInheritedShares(folderId: string, organizationId: string) {
    const folder = await this.findOne(folderId, organizationId);

    const inherited: {
      folderId: string;
      folderName: string;
      users: {
        id: string;
        email: string;
        name: string | null;
        permission: SharePermission;
      }[];
    }[] = [];

    // Walk up the folder tree
    let currentParentId = folder.parentId;
    while (currentParentId) {
      const parentFolder = await this.prisma.folder.findUnique({
        where: { id: currentParentId },
      });

      if (!parentFolder) break;

      // Get shares for this parent folder
      const shares = await this.prisma.documentShare.findMany({
        where: { folderId: currentParentId },
      });

      if (shares.length > 0) {
        const users = await Promise.all(
          shares.map(async (share) => {
            const user = await this.prisma.user.findUnique({
              where: { id: share.sharedWithId },
              select: { id: true, email: true, name: true },
            });
            return {
              id: user?.id || share.sharedWithId,
              email: user?.email || '',
              name: user?.name || null,
              permission: share.permission,
            };
          })
        );

        inherited.push({
          folderId: parentFolder.id,
          folderName: parentFolder.name,
          users,
        });
      }

      currentParentId = parentFolder.parentId;
    }

    return inherited;
  }
}
