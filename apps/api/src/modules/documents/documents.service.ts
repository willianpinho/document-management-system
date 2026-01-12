import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DocumentStatus, ProcessingStatus } from '@prisma/client';
import archiver from 'archiver';

import { PrismaService } from '@/common/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { RealtimeService } from '../realtime/realtime.service';
import { DocumentEventData, EventUser } from '../realtime/dto/realtime-events.dto';
import { ProcessingService } from '../processing/processing.service';
import { ProcessingJobType } from '../processing/queues/queue.constants';

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
    @Inject(forwardRef(() => ProcessingService))
    private readonly processingService: ProcessingService,
  ) {}

  /**
   * Generate a consistent S3 key for storing documents
   * Format: organizations/{organizationId}/documents/{uuid}/{filename}
   */
  private generateS3Key(organizationId: string, filename: string): string {
    const documentId = uuidv4();
    // Sanitize filename to remove special characters that might cause issues
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `organizations/${organizationId}/documents/${documentId}/${sanitizedFilename}`;
  }

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
    const s3Key = this.generateS3Key(input.organizationId, input.name);

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

    // Build where clause using Prisma's query builder
    const where: any = {
      organizationId,
      status: { not: 'DELETED' as const },
    };

    if (folderId) {
      where.folderId = folderId;
    }

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    // Execute queries in parallel for better performance
    const [rawDocuments, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.document.count({ where }),
    ]);

    // Map documents to API response format (handles BigInt)
    const documents = rawDocuments.map((doc) => this.toApiResponse(doc));

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

    // Verify the file exists in S3 before generating download URL
    const url = await this.storageService.getPresignedDownloadUrlIfExists(document.s3Key);

    if (!url) {
      throw new NotFoundException(
        `File not found in storage. The document "${document.name}" may have been deleted from storage.`,
      );
    }

    return {
      url,
      expiresIn: 3600, // 1 hour
    };
  }

  async triggerProcessing(
    id: string,
    organizationId: string,
    operations: string[],
  ) {
    const document = await this.findOne(id, organizationId);

    if (!operations || operations.length === 0) {
      throw new BadRequestException('At least one operation is required');
    }

    // Validate operations
    const validOperations: ProcessingJobType[] = [
      'OCR',
      'THUMBNAIL',
      'EMBEDDING',
      'AI_CLASSIFY',
      'PDF_SPLIT',
      'PDF_MERGE',
      'PDF_WATERMARK',
      'PDF_COMPRESS',
      'PDF_EXTRACT_PAGES',
      'PDF_RENDER_PAGE',
      'PDF_METADATA',
    ];

    const normalizedOperations = operations.map((op) => {
      // Handle common variations
      const normalized = op.toUpperCase().replace(/-/g, '_');
      if (normalized === 'AI_CLASSIFICATION') return 'AI_CLASSIFY';
      if (normalized === 'FULL_PROCESSING') {
        // Return array for full processing
        return ['OCR', 'THUMBNAIL', 'EMBEDDING', 'AI_CLASSIFY'] as const;
      }
      return normalized;
    }).flat() as ProcessingJobType[];

    const invalidOps = normalizedOperations.filter(
      (op) => !validOperations.includes(op),
    );
    if (invalidOps.length > 0) {
      throw new BadRequestException(
        `Invalid operations: ${invalidOps.join(', ')}. Valid operations: ${validOperations.join(', ')}`,
      );
    }

    const jobResults: { jobId: string; operation: string; queueName: string }[] = [];

    // Add each operation to the appropriate queue via ProcessingService
    for (const operation of normalizedOperations) {
      try {
        const result = await this.processingService.addJob(
          document.id,
          operation,
          {}, // Options can be extended later
        );
        jobResults.push({
          jobId: result.job.id,
          operation,
          queueName: result.queueName,
        });
      } catch (error) {
        // Log error but continue with other operations
        console.error(`Failed to add ${operation} job:`, error);
      }
    }

    if (jobResults.length === 0) {
      throw new BadRequestException('Failed to create any processing jobs');
    }

    return {
      jobIds: jobResults.map((r) => r.jobId),
      jobs: jobResults,
      message: `${jobResults.length} processing job(s) queued successfully`,
    };
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

    // Copy the file in S3 using consistent key format
    const newS3Key = this.generateS3Key(organizationId, newName || document.name);
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

        // Copy file in S3 using consistent key format
        const newS3Key = this.generateS3Key(organizationId, document.name);
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

  /**
   * Get document versions
   */
  async getVersions(id: string, organizationId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, organizationId, status: { not: DocumentStatus.DELETED } },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const versions = await this.prisma.documentVersion.findMany({
      where: { documentId: id },
      orderBy: { versionNumber: 'desc' },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    return versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      sizeBytes: Number(v.sizeBytes),
      checksum: v.checksum,
      changeNote: v.changeNote,
      createdAt: v.createdAt,
      createdBy: v.createdBy,
    }));
  }

  /**
   * Get document shares
   */
  async getShares(id: string, organizationId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, organizationId, status: { not: DocumentStatus.DELETED } },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const shares = await this.prisma.documentShare.findMany({
      where: { documentId: id },
    });

    // Fetch user data for each share
    const usersData = await Promise.all(
      shares.map(async (share) => {
        const [sharedWith, sharedBy] = await Promise.all([
          this.prisma.user.findUnique({
            where: { id: share.sharedWithId },
            select: { id: true, name: true, email: true, avatarUrl: true },
          }),
          this.prisma.user.findUnique({
            where: { id: share.sharedById },
            select: { id: true, name: true, email: true },
          }),
        ]);

        return {
          id: share.sharedWithId,
          email: sharedWith?.email || '',
          name: sharedWith?.name,
          avatarUrl: sharedWith?.avatarUrl,
          permission: share.permission,
          sharedAt: share.createdAt,
          sharedBy: sharedBy,
        };
      }),
    );

    // Get share link if exists
    const shareLink = await this.prisma.shareLink.findFirst({
      where: { documentId: id },
    });

    return {
      users: usersData,
      link: shareLink
        ? {
            id: shareLink.id,
            token: shareLink.token,
            permission: shareLink.permission,
            expiresAt: shareLink.expiresAt,
            hasPassword: !!shareLink.password,
            maxUses: shareLink.maxDownloads,
            useCount: shareLink.downloadCount,
            createdAt: shareLink.createdAt,
          }
        : null,
    };
  }
}
