import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DocumentStatus, ProcessingStatus } from '@prisma/client';
import archiver from 'archiver';

import { PrismaService } from '@/common/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { RealtimeService } from '../realtime/realtime.service';
import { DocumentEventData, EventUser } from '../realtime/dto/realtime-events.dto';

interface CreateDocumentInput {
  name: string;
  mimeType: string;
  sizeBytes: number;
  folderId?: string;
  organizationId: string;
  createdById: string;
}

interface UpdateDocumentInput {
  name?: string;
  folderId?: string | null;
  metadata?: Record<string, unknown>;
}

interface FindAllParams {
  organizationId: string;
  page: number;
  limit: number;
  folderId?: string;
  search?: string;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly realtimeService: RealtimeService,
  ) {}

  /**
   * Convert a Prisma document to API-safe format (handles BigInt serialization)
   */
  private toApiResponse(document: any) {
    return {
      id: document.id,
      name: document.name,
      mimeType: document.mimeType,
      sizeBytes: Number(document.sizeBytes),
      s3Key: document.s3Key,
      status: document.status,
      processingStatus: document.processingStatus,
      folderId: document.folderId,
      thumbnailKey: document.thumbnailKey,
      checksum: document.checksum,
      metadata: document.metadata,
      extractedText: document.extractedText,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      deletedAt: document.deletedAt,
      createdBy: document.createdBy,
      folder: document.folder,
      versions: document.versions?.map((v: any) => ({
        ...v,
        sizeBytes: Number(v.sizeBytes),
      })),
    };
  }

  /**
   * Convert a Prisma document to event data format
   */
  private toEventData(document: {
    id: string;
    name: string;
    mimeType: string;
    sizeBytes: number | bigint;
    status: string | DocumentStatus;
    processingStatus: string | ProcessingStatus;
    folderId: string | null;
    s3Key: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy?: { id: string; name: string | null; email: string } | null;
  }): DocumentEventData {
    return {
      id: document.id,
      name: document.name,
      mimeType: document.mimeType,
      sizeBytes: Number(document.sizeBytes),
      status: String(document.status),
      processingStatus: String(document.processingStatus),
      folderId: document.folderId,
      s3Key: document.s3Key,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
      createdBy: document.createdBy
        ? {
            id: document.createdBy.id,
            name: document.createdBy.name,
            email: document.createdBy.email,
          }
        : undefined,
    };
  }

  async create(input: CreateDocumentInput, triggeredBy?: EventUser) {
    const s3Key = `${input.organizationId}/${uuidv4()}/${input.name}`;

    const document = await this.prisma.document.create({
      data: {
        name: input.name,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        s3Key,
        status: DocumentStatus.PROCESSING,
        processingStatus: ProcessingStatus.PENDING,
        organizationId: input.organizationId,
        folderId: input.folderId,
        createdById: input.createdById,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const uploadUrl = await this.storageService.getPresignedUploadUrl(s3Key, input.mimeType);

    // Emit real-time event
    if (triggeredBy) {
      this.realtimeService.emitDocumentCreated(
        this.toEventData(document),
        input.organizationId,
        triggeredBy,
        uploadUrl,
      );
    }

    return {
      document: this.toApiResponse(document),
      uploadUrl,
    };
  }

  async findAll(params: FindAllParams) {
    const { organizationId, page, limit, folderId, search } = params;
    const skip = (page - 1) * limit;

    // Use Prisma's typed template for safe query building
    const { Prisma } = require('@prisma/client');

    // Build WHERE conditions
    const conditions = [
      Prisma.sql`d.organization_id = ${organizationId}::uuid`,
      Prisma.sql`d.status != 'DELETED'`,
    ];

    if (folderId) {
      conditions.push(Prisma.sql`d.folder_id = ${folderId}::uuid`);
    }

    if (search) {
      conditions.push(Prisma.sql`d.name ILIKE ${`%${search}%`}`);
    }

    const whereClause = Prisma.join(conditions, ' AND ');

    const rawDocuments = await this.prisma.$queryRaw<any[]>`
      SELECT
        d.id, d.name, d.mime_type as "mimeType", d.size_bytes as "sizeBytes",
        d.s3_key as "s3Key", d.status, d.processing_status as "processingStatus",
        d.folder_id as "folderId", d.thumbnail_key as "thumbnailKey",
        d.checksum, d.metadata, d.extracted_text as "extractedText",
        d.created_at as "createdAt", d.updated_at as "updatedAt", d.deleted_at as "deletedAt",
        u.id as "createdById", u.name as "createdByName", u.email as "createdByEmail"
      FROM documents d
      LEFT JOIN users u ON d.created_by_id = u.id
      WHERE ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT ${limit} OFFSET ${skip}
    `;

    const countResult = await this.prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*) as total
      FROM documents d
      WHERE ${whereClause}
    `;

    const documents = rawDocuments.map((doc) => ({
      id: doc.id,
      name: doc.name,
      mimeType: doc.mimeType,
      sizeBytes: Number(doc.sizeBytes),
      s3Key: doc.s3Key,
      status: doc.status,
      processingStatus: doc.processingStatus,
      folderId: doc.folderId,
      thumbnailKey: doc.thumbnailKey,
      checksum: doc.checksum,
      metadata: doc.metadata,
      extractedText: doc.extractedText,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      deletedAt: doc.deletedAt,
      createdBy: doc.createdById
        ? {
            id: doc.createdById,
            name: doc.createdByName,
            email: doc.createdByEmail,
          }
        : null,
    }));

    const total = Number(countResult[0]?.total || 0);

    return {
      data: documents,
      meta: {
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrevious: page > 1,
        },
      },
    };
  }

  async findOne(id: string, organizationId: string) {
    // Select specific fields to avoid contentVector (pgvector) column issues
    const document = await this.prisma.document.findFirst({
      where: { id, organizationId, status: { not: DocumentStatus.DELETED } },
      select: {
        id: true,
        name: true,
        mimeType: true,
        sizeBytes: true,
        s3Key: true,
        s3VersionId: true,
        status: true,
        processingStatus: true,
        folderId: true,
        thumbnailKey: true,
        checksum: true,
        metadata: true,
        extractedText: true,
        originalName: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        folder: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 10,
          select: {
            id: true,
            versionNumber: true,
            s3Key: true,
            s3VersionId: true,
            sizeBytes: true,
            checksum: true,
            changeNote: true,
            createdAt: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return this.toApiResponse(document);
  }

  async update(
    id: string,
    organizationId: string,
    input: UpdateDocumentInput,
    triggeredBy?: EventUser,
  ) {
    const existingDocument = await this.findOne(id, organizationId);

    // Track changes for event
    const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];
    if (input.name && input.name !== existingDocument.name) {
      changes.push({ field: 'name', oldValue: existingDocument.name, newValue: input.name });
    }
    if (input.folderId !== undefined && input.folderId !== existingDocument.folderId) {
      changes.push({ field: 'folderId', oldValue: existingDocument.folderId, newValue: input.folderId });
    }

    const document = await this.prisma.document.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.folderId !== undefined && { folderId: input.folderId }),
        ...(input.metadata && { metadata: input.metadata as any }),
      } as any,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Emit real-time event
    if (triggeredBy && changes.length > 0) {
      this.realtimeService.emitDocumentUpdated(
        this.toEventData(document),
        organizationId,
        triggeredBy,
        changes,
      );
    }

    return this.toApiResponse(document);
  }

  async remove(id: string, organizationId: string, triggeredBy?: EventUser) {
    const document = await this.findOne(id, organizationId);

    // Soft delete
    const deletedDocument = await this.prisma.document.update({
      where: { id },
      data: { status: DocumentStatus.DELETED },
    });

    // Emit real-time event
    if (triggeredBy) {
      this.realtimeService.emitDocumentDeleted(
        document.id,
        document.name,
        organizationId,
        triggeredBy,
      );
    }

    return this.toApiResponse(deletedDocument);
  }

  async getDownloadUrl(id: string, organizationId: string) {
    const document = await this.findOne(id, organizationId);

    const url = await this.storageService.getPresignedDownloadUrl(document.s3Key);

    return {
      url,
      expiresIn: 3600, // 1 hour
    };
  }

  async triggerProcessing(
    id: string,
    organizationId: string,
    processDto: { type: string; options?: Record<string, unknown> },
  ) {
    const document = await this.findOne(id, organizationId);

    // Create processing job
    const job = await this.prisma.processingJob.create({
      data: {
        documentId: document.id,
        jobType: processDto.type as any,
        status: 'PENDING',
        inputParams: (processDto.options || {}) as any,
      },
    });

    // Update document status
    await this.prisma.document.update({
      where: { id },
      data: { processingStatus: ProcessingStatus.OCR_IN_PROGRESS },
    });

    // TODO: Add job to queue (BullMQ)

    return { job, message: 'Processing job created' };
  }

  async confirmUpload(id: string, organizationId: string) {
    await this.findOne(id, organizationId);

    const document = await this.prisma.document.update({
      where: { id },
      data: { status: DocumentStatus.UPLOADED },
    });

    return this.toApiResponse(document);
  }

  /**
   * Get the document buffer from S3
   * @param id - Document ID
   * @param organizationId - Organization ID for access control
   * @returns Buffer containing the document
   */
  async getDocumentBuffer(id: string, organizationId: string): Promise<Buffer> {
    const document = await this.findOne(id, organizationId);

    const fileStream = await this.storageService.getObject(document.s3Key);
    const chunks: Buffer[] = [];

    for await (const chunk of fileStream as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  /**
   * Get multiple document buffers from S3
   * @param ids - Array of document IDs
   * @param organizationId - Organization ID for access control
   * @returns Array of buffers
   */
  async getDocumentBuffers(ids: string[], organizationId: string): Promise<Buffer[]> {
    const buffers: Buffer[] = [];

    for (const id of ids) {
      const buffer = await this.getDocumentBuffer(id, organizationId);
      buffers.push(buffer);
    }

    return buffers;
  }

  /**
   * Move a document to a different folder
   * @param id - Document ID
   * @param organizationId - Organization ID for access control
   * @param targetFolderId - Target folder ID (null for root)
   * @param triggeredBy - User who triggered the action
   */
  async move(
    id: string,
    organizationId: string,
    targetFolderId: string | null,
    triggeredBy?: EventUser,
  ) {
    const document = await this.findOne(id, organizationId);

    // Verify target folder exists and belongs to organization
    if (targetFolderId) {
      const folder = await this.prisma.folder.findFirst({
        where: { id: targetFolderId, organizationId },
      });
      if (!folder) {
        throw new NotFoundException('Target folder not found');
      }
    }

    const updatedDocument = await this.prisma.document.update({
      where: { id },
      data: { folderId: targetFolderId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Emit real-time event
    if (triggeredBy) {
      this.realtimeService.emitDocumentUpdated(
        this.toEventData(updatedDocument),
        organizationId,
        triggeredBy,
        [{ field: 'folderId', oldValue: document.folderId, newValue: targetFolderId }],
      );
    }

    return this.toApiResponse(updatedDocument);
  }

  /**
   * Copy a document to a different folder
   * @param id - Document ID
   * @param organizationId - Organization ID for access control
   * @param targetFolderId - Target folder ID (null for root)
   * @param newName - Optional new name for the copy
   * @param triggeredBy - User who triggered the action
   */
  async copy(
    id: string,
    organizationId: string,
    targetFolderId: string | null,
    newName?: string,
    triggeredBy?: EventUser,
  ) {
    const document = await this.findOne(id, organizationId);

    // Verify target folder exists and belongs to organization
    if (targetFolderId) {
      const folder = await this.prisma.folder.findFirst({
        where: { id: targetFolderId, organizationId },
      });
      if (!folder) {
        throw new NotFoundException('Target folder not found');
      }
    }

    // Copy the file in S3
    const newS3Key = `organizations/${organizationId}/documents/${Date.now()}-${document.name}`;
    await this.storageService.copyObject(document.s3Key, newS3Key);

    // Create new document record
    const copiedDocument = await this.prisma.document.create({
      data: {
        name: newName || `Copy of ${document.name}`,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        s3Key: newS3Key,
        status: document.status,
        processingStatus: document.processingStatus,
        folderId: targetFolderId,
        organizationId,
        createdById: triggeredBy?.id || document.createdBy?.id,
        metadata: document.metadata as any,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Emit real-time event for the new document
    if (triggeredBy) {
      this.realtimeService.emitDocumentCreated(
        this.toEventData(copiedDocument),
        organizationId,
        triggeredBy,
      );
    }

    return this.toApiResponse(copiedDocument);
  }

  // ============================================
  // Bulk Operations
  // ============================================

  /**
   * Bulk delete documents and folders
   */
  async bulkDelete(
    organizationId: string,
    documentIds: string[],
    folderIds: string[] = [],
    permanent = false,
    triggeredBy?: EventUser,
  ) {
    const results: { id: string; success: boolean; error?: string }[] = [];

    // Delete documents
    for (const id of documentIds) {
      try {
        const document = await this.prisma.document.findFirst({
          where: { id, organizationId, status: { not: DocumentStatus.DELETED } },
        });

        if (!document) {
          results.push({ id, success: false, error: 'Document not found' });
          continue;
        }

        if (permanent) {
          // Permanently delete from S3 and database
          await this.storageService.deleteObject(document.s3Key);
          await this.prisma.document.delete({ where: { id } });
        } else {
          // Soft delete
          await this.prisma.document.update({
            where: { id },
            data: { status: DocumentStatus.DELETED, deletedAt: new Date() },
          });
        }

        // Emit real-time event
        if (triggeredBy) {
          this.realtimeService.emitDocumentDeleted(
            document.id,
            document.name,
            organizationId,
            triggeredBy,
          );
        }

        results.push({ id, success: true });
      } catch (error) {
        results.push({
          id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Delete folders
    for (const id of folderIds) {
      try {
        const folder = await this.prisma.folder.findFirst({
          where: { id, organizationId },
        });

        if (!folder) {
          results.push({ id, success: false, error: 'Folder not found' });
          continue;
        }

        // Get all documents in folder and subfolders
        const documentsInFolder = await this.prisma.document.findMany({
          where: {
            organizationId,
            folder: {
              OR: [
                { id },
                { path: { startsWith: folder.path + '/' } },
              ],
            },
            status: { not: DocumentStatus.DELETED },
          },
        });

        // Delete documents in folder
        for (const doc of documentsInFolder) {
          if (permanent) {
            await this.storageService.deleteObject(doc.s3Key);
            await this.prisma.document.delete({ where: { id: doc.id } });
          } else {
            await this.prisma.document.update({
              where: { id: doc.id },
              data: { status: DocumentStatus.DELETED, deletedAt: new Date() },
            });
          }

          if (triggeredBy) {
            this.realtimeService.emitDocumentDeleted(
              doc.id,
              doc.name,
              organizationId,
              triggeredBy,
            );
          }
        }

        // Delete folder and subfolders
        await this.prisma.folder.deleteMany({
          where: {
            organizationId,
            OR: [
              { id },
              { path: { startsWith: folder.path + '/' } },
            ],
          },
        });

        results.push({ id, success: true });
      } catch (error) {
        results.push({
          id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return {
      total: results.length,
      successful,
      failed,
      results,
    };
  }

  /**
   * Bulk move documents and folders
   */
  async bulkMove(
    organizationId: string,
    documentIds: string[],
    folderIds: string[] = [],
    targetFolderId: string | null,
    triggeredBy?: EventUser,
  ) {
    const results: { id: string; success: boolean; error?: string }[] = [];

    // Verify target folder exists
    if (targetFolderId) {
      const targetFolder = await this.prisma.folder.findFirst({
        where: { id: targetFolderId, organizationId },
      });
      if (!targetFolder) {
        throw new BadRequestException('Target folder not found');
      }
    }

    // Move documents
    for (const id of documentIds) {
      try {
        const document = await this.prisma.document.findFirst({
          where: { id, organizationId, status: { not: DocumentStatus.DELETED } },
          include: { createdBy: { select: { id: true, name: true, email: true } } },
        });

        if (!document) {
          results.push({ id, success: false, error: 'Document not found' });
          continue;
        }

        const oldFolderId = document.folderId;

        await this.prisma.document.update({
          where: { id },
          data: { folderId: targetFolderId },
        });

        // Emit real-time event
        if (triggeredBy) {
          this.realtimeService.emitDocumentUpdated(
            this.toEventData(document),
            organizationId,
            triggeredBy,
            [{ field: 'folderId', oldValue: oldFolderId, newValue: targetFolderId }],
          );
        }

        results.push({ id, success: true });
      } catch (error) {
        results.push({
          id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Move folders
    for (const id of folderIds) {
      try {
        const folder = await this.prisma.folder.findFirst({
          where: { id, organizationId },
        });

        if (!folder) {
          results.push({ id, success: false, error: 'Folder not found' });
          continue;
        }

        // Prevent moving folder into itself or its descendants
        if (targetFolderId) {
          const targetPath = (await this.prisma.folder.findUnique({
            where: { id: targetFolderId },
          }))?.path || '';

          if (targetPath.startsWith(folder.path)) {
            results.push({ id, success: false, error: 'Cannot move folder into itself or its descendants' });
            continue;
          }
        }

        // Get new path
        let newPath = folder.name;
        if (targetFolderId) {
          const parent = await this.prisma.folder.findUnique({
            where: { id: targetFolderId },
          });
          newPath = `${parent?.path}/${folder.name}`;
        }

        // Update folder and its descendants
        const oldPath = folder.path;
        await this.prisma.folder.update({
          where: { id },
          data: { parentId: targetFolderId, path: newPath },
        });

        // Update descendants paths
        await this.prisma.$executeRaw`
          UPDATE folders
          SET path = REPLACE(path, ${oldPath}, ${newPath})
          WHERE organization_id = ${organizationId}::uuid
          AND path LIKE ${oldPath + '/%'}
        `;

        results.push({ id, success: true });
      } catch (error) {
        results.push({
          id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return {
      total: results.length,
      successful,
      failed,
      results,
    };
  }

  /**
   * Bulk copy documents
   */
  async bulkCopy(
    organizationId: string,
    documentIds: string[],
    targetFolderId: string | null,
    triggeredBy?: EventUser,
  ) {
    const results: { id: string; success: boolean; error?: string; newId?: string }[] = [];

    // Verify target folder exists
    if (targetFolderId) {
      const targetFolder = await this.prisma.folder.findFirst({
        where: { id: targetFolderId, organizationId },
      });
      if (!targetFolder) {
        throw new BadRequestException('Target folder not found');
      }
    }

    for (const id of documentIds) {
      try {
        const document = await this.prisma.document.findFirst({
          where: { id, organizationId, status: { not: DocumentStatus.DELETED } },
          include: { createdBy: { select: { id: true, name: true, email: true } } },
        });

        if (!document) {
          results.push({ id, success: false, error: 'Document not found' });
          continue;
        }

        // Copy file in S3
        const newS3Key = `organizations/${organizationId}/documents/${uuidv4()}-${document.name}`;
        await this.storageService.copyObject(document.s3Key, newS3Key);

        // Create copy in database
        const copy = await this.prisma.document.create({
          data: {
            name: `Copy of ${document.name}`,
            mimeType: document.mimeType,
            sizeBytes: document.sizeBytes,
            s3Key: newS3Key,
            status: document.status,
            processingStatus: document.processingStatus,
            folderId: targetFolderId,
            organizationId,
            createdById: triggeredBy?.id || document.createdById,
            metadata: document.metadata as any,
          },
          include: {
            createdBy: { select: { id: true, name: true, email: true } },
          },
        });

        // Emit real-time event
        if (triggeredBy) {
          this.realtimeService.emitDocumentCreated(
            this.toEventData(copy),
            organizationId,
            triggeredBy,
          );
        }

        results.push({ id, success: true, newId: copy.id });
      } catch (error) {
        results.push({
          id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return {
      total: results.length,
      successful,
      failed,
      results,
    };
  }

  /**
   * Create a zip file for bulk download
   */
  async createBulkDownload(
    organizationId: string,
    documentIds: string[],
    folderIds: string[] = [],
  ): Promise<{ downloadUrl: string; expiresIn: number; fileCount: number; totalSizeBytes: number }> {
    const documents: { id: string; name: string; s3Key: string; sizeBytes: bigint; folderPath?: string }[] = [];

    // Get documents by ID
    for (const id of documentIds) {
      const doc = await this.prisma.document.findFirst({
        where: { id, organizationId, status: { not: DocumentStatus.DELETED } },
        include: { folder: true },
      });
      if (doc) {
        documents.push({
          id: doc.id,
          name: doc.name,
          s3Key: doc.s3Key,
          sizeBytes: doc.sizeBytes,
          folderPath: doc.folder?.path,
        });
      }
    }

    // Get documents from folders
    for (const folderId of folderIds) {
      const folder = await this.prisma.folder.findFirst({
        where: { id: folderId, organizationId },
      });
      if (folder) {
        const folderDocs = await this.prisma.document.findMany({
          where: {
            organizationId,
            status: { not: DocumentStatus.DELETED },
            OR: [
              { folderId },
              { folder: { path: { startsWith: folder.path + '/' } } },
            ],
          },
          include: { folder: true },
        });
        for (const doc of folderDocs) {
          documents.push({
            id: doc.id,
            name: doc.name,
            s3Key: doc.s3Key,
            sizeBytes: doc.sizeBytes,
            folderPath: doc.folder?.path,
          });
        }
      }
    }

    if (documents.length === 0) {
      throw new BadRequestException('No documents to download');
    }

    // Create zip archive
    const archive = archiver('zip', { zlib: { level: 5 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => chunks.push(chunk));

    // Add documents to archive
    for (const doc of documents) {
      try {
        const fileStream = await this.storageService.getObject(doc.s3Key);
        const fileChunks: Buffer[] = [];
        for await (const chunk of fileStream as AsyncIterable<Buffer>) {
          fileChunks.push(chunk);
        }
        const fileBuffer = Buffer.concat(fileChunks);

        const filePath = doc.folderPath ? `${doc.folderPath}/${doc.name}` : doc.name;
        archive.append(fileBuffer, { name: filePath });
      } catch {
        // Skip files that can't be read
      }
    }

    await archive.finalize();

    // Wait for archive to finish
    await new Promise<void>((resolve) => {
      archive.on('end', resolve);
    });

    const zipBuffer = Buffer.concat(chunks);
    const zipKey = `temp/bulk-downloads/${organizationId}/${uuidv4()}.zip`;

    // Upload zip to S3
    await this.storageService.uploadBuffer(zipKey, zipBuffer, 'application/zip');

    // Get download URL
    const downloadUrl = await this.storageService.getPresignedDownloadUrl(zipKey, 3600);

    const totalSizeBytes = documents.reduce((sum, doc) => sum + Number(doc.sizeBytes), 0);

    return {
      downloadUrl,
      expiresIn: 3600,
      fileCount: documents.length,
      totalSizeBytes,
    };
  }
}
