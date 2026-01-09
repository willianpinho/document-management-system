import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DocumentStatus, ProcessingStatus } from '@prisma/client';

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
}
