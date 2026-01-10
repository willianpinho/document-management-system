import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { UploadStatus, DocumentStatus, ProcessingStatus, Prisma } from '@prisma/client';

import { PrismaService } from '@/common/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  CreateUploadSessionDto,
  UploadSessionResponseDto,
  UploadChunkResponseDto,
  CompleteUploadResponseDto,
  ChunkPresignedUrlDto,
} from './dto';

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const SESSION_EXPIRY_HOURS = 24;

@Injectable()
export class UploadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly realtimeService: RealtimeService,
  ) {}

  /**
   * Create a new upload session for resumable upload
   */
  async createSession(
    userId: string,
    organizationId: string,
    dto: CreateUploadSessionDto,
  ): Promise<UploadSessionResponseDto> {
    const chunkSize = dto.chunkSize || DEFAULT_CHUNK_SIZE;
    const totalChunks = Math.ceil(dto.totalBytes / chunkSize);

    // Generate S3 key
    const s3Key = `uploads/${organizationId}/${uuidv4()}/${dto.fileName}`;

    // Create multipart upload in S3
    const s3UploadId = await this.storageService.createMultipartUpload(
      s3Key,
      dto.mimeType,
    );

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + SESSION_EXPIRY_HOURS);

    // Create session in database
    const session = await this.prisma.uploadSession.create({
      data: {
        organizationId,
        userId,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        totalBytes: BigInt(dto.totalBytes),
        chunkSize,
        totalChunks,
        s3Key,
        s3UploadId,
        folderId: dto.folderId,
        metadata: (dto.metadata || {}) as Prisma.InputJsonValue,
        status: UploadStatus.PENDING,
        expiresAt,
      },
    });

    return this.toSessionResponse(session);
  }

  /**
   * Get an existing upload session
   */
  async getSession(
    sessionId: string,
    organizationId: string,
  ): Promise<UploadSessionResponseDto> {
    const session = await this.prisma.uploadSession.findFirst({
      where: {
        id: sessionId,
        organizationId,
      },
      include: {
        chunks: {
          select: { chunkNumber: true },
          orderBy: { chunkNumber: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Upload session not found');
    }

    // Check if expired
    if (session.expiresAt < new Date()) {
      throw new BadRequestException('Upload session has expired');
    }

    return this.toSessionResponse(session);
  }

  /**
   * Get a presigned URL for uploading a specific chunk
   */
  async getChunkUploadUrl(
    sessionId: string,
    organizationId: string,
    chunkNumber: number,
  ): Promise<ChunkPresignedUrlDto> {
    const session = await this.prisma.uploadSession.findFirst({
      where: {
        id: sessionId,
        organizationId,
      },
    });

    if (!session) {
      throw new NotFoundException('Upload session not found');
    }

    if (session.status === UploadStatus.COMPLETED) {
      throw new BadRequestException('Upload session is already completed');
    }

    if (chunkNumber < 0 || chunkNumber >= session.totalChunks) {
      throw new BadRequestException(
        `Invalid chunk number. Must be between 0 and ${session.totalChunks - 1}`,
      );
    }

    // Check if chunk already uploaded
    const existingChunk = await this.prisma.uploadChunk.findUnique({
      where: {
        uploadSessionId_chunkNumber: {
          uploadSessionId: sessionId,
          chunkNumber,
        },
      },
    });

    if (existingChunk) {
      throw new ConflictException(`Chunk ${chunkNumber} has already been uploaded`);
    }

    // Get presigned URL for this part (S3 part numbers are 1-indexed)
    const uploadUrl = await this.storageService.getPresignedPartUploadUrl(
      session.s3Key,
      session.s3UploadId!,
      chunkNumber + 1,
      3600,
    );

    return {
      uploadUrl,
      chunkNumber,
      expiresIn: 3600,
    };
  }

  /**
   * Mark a chunk as uploaded (called after client uploads directly to S3)
   */
  async confirmChunk(
    sessionId: string,
    organizationId: string,
    chunkNumber: number,
    etag: string,
    sizeBytes: number,
  ): Promise<UploadChunkResponseDto> {
    const session = await this.prisma.uploadSession.findFirst({
      where: {
        id: sessionId,
        organizationId,
      },
    });

    if (!session) {
      throw new NotFoundException('Upload session not found');
    }

    if (session.status === UploadStatus.COMPLETED) {
      throw new BadRequestException('Upload session is already completed');
    }

    // Record the chunk
    await this.prisma.uploadChunk.upsert({
      where: {
        uploadSessionId_chunkNumber: {
          uploadSessionId: sessionId,
          chunkNumber,
        },
      },
      create: {
        uploadSessionId: sessionId,
        chunkNumber,
        sizeBytes,
        s3ETag: etag,
      },
      update: {
        sizeBytes,
        s3ETag: etag,
        uploadedAt: new Date(),
      },
    });

    // Update session progress
    const uploadedChunks = await this.prisma.uploadChunk.count({
      where: { uploadSessionId: sessionId },
    });

    const uploadedBytes = await this.prisma.uploadChunk.aggregate({
      where: { uploadSessionId: sessionId },
      _sum: { sizeBytes: true },
    });

    const updatedSession = await this.prisma.uploadSession.update({
      where: { id: sessionId },
      data: {
        uploadedChunks,
        uploadedBytes: BigInt(uploadedBytes._sum.sizeBytes || 0),
        status: UploadStatus.IN_PROGRESS,
      },
    });

    const isComplete = uploadedChunks >= session.totalChunks;

    return {
      success: true,
      chunkNumber,
      sizeBytes,
      uploadedBytes: Number(updatedSession.uploadedBytes),
      uploadedChunks: updatedSession.uploadedChunks,
      isComplete,
    };
  }

  /**
   * Complete the upload session and create the document
   */
  async completeUpload(
    sessionId: string,
    userId: string,
    organizationId: string,
  ): Promise<CompleteUploadResponseDto> {
    const session = await this.prisma.uploadSession.findFirst({
      where: {
        id: sessionId,
        organizationId,
      },
      include: {
        chunks: {
          orderBy: { chunkNumber: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Upload session not found');
    }

    if (session.status === UploadStatus.COMPLETED) {
      throw new BadRequestException('Upload session is already completed');
    }

    // Verify all chunks are uploaded
    if (session.chunks.length < session.totalChunks) {
      throw new BadRequestException(
        `Missing chunks: uploaded ${session.chunks.length}/${session.totalChunks}`,
      );
    }

    // Complete multipart upload in S3
    const parts = session.chunks.map((chunk) => ({
      etag: chunk.s3ETag!,
      partNumber: chunk.chunkNumber + 1, // S3 is 1-indexed
    }));

    await this.storageService.completeMultipartUpload(
      session.s3Key,
      session.s3UploadId!,
      parts,
    );

    // Create the document
    const document = await this.prisma.document.create({
      data: {
        organizationId,
        folderId: session.folderId,
        name: session.fileName,
        originalName: session.fileName,
        mimeType: session.mimeType,
        sizeBytes: session.totalBytes,
        s3Key: session.s3Key,
        status: DocumentStatus.UPLOADED,
        processingStatus: ProcessingStatus.PENDING,
        metadata: session.metadata as object,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Update session status
    await this.prisma.uploadSession.update({
      where: { id: sessionId },
      data: {
        status: UploadStatus.COMPLETED,
      },
    });

    // Update organization storage usage
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        storageUsedBytes: {
          increment: session.totalBytes,
        },
      },
    });

    // Emit real-time event
    this.realtimeService.emitDocumentCreated(
      {
        id: document.id,
        name: document.name,
        mimeType: document.mimeType,
        sizeBytes: Number(document.sizeBytes),
        status: document.status,
        processingStatus: document.processingStatus,
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
      },
      organizationId,
      {
        id: userId,
        name: document.createdBy?.name || null,
        email: document.createdBy?.email || '',
      },
    );

    return {
      success: true,
      documentId: document.id,
      name: document.name,
      s3Key: document.s3Key,
    };
  }

  /**
   * Cancel an upload session
   */
  async cancelUpload(
    sessionId: string,
    organizationId: string,
  ): Promise<void> {
    const session = await this.prisma.uploadSession.findFirst({
      where: {
        id: sessionId,
        organizationId,
      },
    });

    if (!session) {
      throw new NotFoundException('Upload session not found');
    }

    if (session.status === UploadStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed upload');
    }

    // Abort multipart upload in S3
    if (session.s3UploadId) {
      try {
        await this.storageService.abortMultipartUpload(
          session.s3Key,
          session.s3UploadId,
        );
      } catch (error) {
        // Ignore errors if upload doesn't exist in S3
      }
    }

    // Update session status
    await this.prisma.uploadSession.update({
      where: { id: sessionId },
      data: {
        status: UploadStatus.CANCELLED,
      },
    });
  }

  /**
   * List active upload sessions for an organization
   */
  async listSessions(
    organizationId: string,
    userId?: string,
  ): Promise<UploadSessionResponseDto[]> {
    const sessions = await this.prisma.uploadSession.findMany({
      where: {
        organizationId,
        userId: userId,
        status: {
          in: [UploadStatus.PENDING, UploadStatus.IN_PROGRESS],
        },
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        chunks: {
          select: { chunkNumber: true },
          orderBy: { chunkNumber: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return sessions.map((s) => this.toSessionResponse(s));
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    // Find expired sessions
    const expiredSessions = await this.prisma.uploadSession.findMany({
      where: {
        status: {
          in: [UploadStatus.PENDING, UploadStatus.IN_PROGRESS],
        },
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    // Abort S3 uploads
    for (const session of expiredSessions) {
      if (session.s3UploadId) {
        try {
          await this.storageService.abortMultipartUpload(
            session.s3Key,
            session.s3UploadId,
          );
        } catch (error) {
          // Ignore errors
        }
      }
    }

    // Update session statuses
    const result = await this.prisma.uploadSession.updateMany({
      where: {
        id: {
          in: expiredSessions.map((s) => s.id),
        },
      },
      data: {
        status: UploadStatus.FAILED,
      },
    });

    return result.count;
  }

  /**
   * Convert database session to response DTO
   */
  private toSessionResponse(
    session: any,
  ): UploadSessionResponseDto {
    const completedChunks = session.chunks
      ? session.chunks.map((c: { chunkNumber: number }) => c.chunkNumber)
      : [];

    return {
      id: session.id,
      fileName: session.fileName,
      mimeType: session.mimeType,
      totalBytes: Number(session.totalBytes),
      uploadedBytes: Number(session.uploadedBytes),
      chunkSize: session.chunkSize,
      totalChunks: session.totalChunks,
      uploadedChunks: session.uploadedChunks,
      status: session.status,
      expiresAt: session.expiresAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
      completedChunks,
    };
  }
}
