import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';

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
}
