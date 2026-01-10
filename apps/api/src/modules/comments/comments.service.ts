import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';

import { PrismaService } from '@/common/prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateCommentDto, UpdateCommentDto, CommentResponseDto } from './dto';

interface CommentFilter {
  documentId: string;
  organizationId: string;
  page?: number;
  limit?: number;
  includeReplies?: boolean;
  parentId?: string | null;
}

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  /**
   * Transform a Prisma comment to API response format
   */
  private toResponse(comment: any): CommentResponseDto {
    return {
      id: comment.id,
      documentId: comment.documentId,
      author: {
        id: comment.author.id,
        name: comment.author.name,
        email: comment.author.email,
        avatarUrl: comment.author.avatarUrl,
      },
      parentId: comment.parentId,
      content: comment.content,
      isResolved: comment.isResolved,
      resolvedBy: comment.resolvedBy
        ? {
            id: comment.resolvedBy.id,
            name: comment.resolvedBy.name,
            email: comment.resolvedBy.email,
            avatarUrl: comment.resolvedBy.avatarUrl,
          }
        : null,
      resolvedAt: comment.resolvedAt,
      editedAt: comment.editedAt,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      pageNumber: comment.pageNumber,
      positionX: comment.positionX,
      positionY: comment.positionY,
      selectionStart: comment.selectionStart,
      selectionEnd: comment.selectionEnd,
      mentions: comment.mentions?.map((m: any) => ({
        id: m.mentionedId,
        name: m.mentioned?.name || null,
        email: m.mentioned?.email || '',
      })) || [],
      replyCount: comment._count?.replies || 0,
      replies: comment.replies?.map((r: any) => this.toResponse(r)),
    };
  }

  /**
   * Create a new comment on a document
   */
  async create(
    documentId: string,
    authorId: string,
    organizationId: string,
    dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    // Verify document belongs to organization
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // If replying to a comment, verify parent exists
    if (dto.parentId) {
      const parentComment = await this.prisma.comment.findFirst({
        where: {
          id: dto.parentId,
          documentId,
        },
      });

      if (!parentComment) {
        throw new NotFoundException('Parent comment not found');
      }
    }

    // Create comment with mentions
    const comment = await this.prisma.comment.create({
      data: {
        documentId,
        authorId,
        parentId: dto.parentId,
        content: dto.content,
        pageNumber: dto.pageNumber,
        positionX: dto.positionX,
        positionY: dto.positionY,
        selectionStart: dto.selectionStart,
        selectionEnd: dto.selectionEnd,
        mentions: dto.mentions?.length
          ? {
              create: dto.mentions.map((userId) => ({
                mentionedId: userId,
              })),
            }
          : undefined,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        mentions: true,
        _count: { select: { replies: true } },
      },
    });

    const response = this.toResponse(comment);

    // Emit real-time event
    this.realtimeService.emitToDocument(documentId, 'comment:created', {
      comment: response,
    });

    return response;
  }

  /**
   * Get all comments for a document
   */
  async findAll(filter: CommentFilter) {
    const { documentId, organizationId, page = 1, limit = 50, includeReplies = true, parentId = null } = filter;

    // Verify document belongs to organization
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const where = {
      documentId,
      parentId, // Only get top-level comments by default
    };

    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          author: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          resolvedBy: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          mentions: {
            include: {
              // We need to get mentioned user info separately
            },
          },
          _count: { select: { replies: true } },
          ...(includeReplies && {
            replies: {
              orderBy: { createdAt: 'asc' },
              include: {
                author: {
                  select: { id: true, name: true, email: true, avatarUrl: true },
                },
                resolvedBy: {
                  select: { id: true, name: true, email: true, avatarUrl: true },
                },
                mentions: true,
                _count: { select: { replies: true } },
              },
            },
          }),
        },
      }),
      this.prisma.comment.count({ where }),
    ]);

    return {
      data: comments.map((c) => this.toResponse(c)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single comment by ID
   */
  async findOne(commentId: string, organizationId: string): Promise<CommentResponseDto> {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId },
      include: {
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        resolvedBy: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        document: {
          select: { organizationId: true },
        },
        mentions: true,
        _count: { select: { replies: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
            mentions: true,
            _count: { select: { replies: true } },
          },
        },
      },
    });

    if (!comment || comment.document.organizationId !== organizationId) {
      throw new NotFoundException('Comment not found');
    }

    return this.toResponse(comment);
  }

  /**
   * Update a comment
   */
  async update(
    commentId: string,
    userId: string,
    organizationId: string,
    dto: UpdateCommentDto,
  ): Promise<CommentResponseDto> {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId },
      include: {
        document: { select: { organizationId: true } },
      },
    });

    if (!comment || comment.document.organizationId !== organizationId) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    // Update comment
    const updated = await this.prisma.$transaction(async (tx) => {
      // Delete existing mentions if updating mentions
      if (dto.mentions) {
        await tx.commentMention.deleteMany({
          where: { commentId },
        });
      }

      return tx.comment.update({
        where: { id: commentId },
        data: {
          content: dto.content,
          editedAt: new Date(),
          mentions: dto.mentions?.length
            ? {
                create: dto.mentions.map((userId) => ({
                  mentionedId: userId,
                })),
              }
            : undefined,
        },
        include: {
          author: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          resolvedBy: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          mentions: true,
          _count: { select: { replies: true } },
        },
      });
    });

    const response = this.toResponse(updated);

    // Emit real-time event
    this.realtimeService.emitToDocument(comment.documentId, 'comment:updated', {
      comment: response,
    });

    return response;
  }

  /**
   * Resolve or unresolve a comment
   */
  async resolve(
    commentId: string,
    userId: string,
    organizationId: string,
    resolved: boolean = true,
  ): Promise<CommentResponseDto> {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId },
      include: {
        document: { select: { organizationId: true } },
      },
    });

    if (!comment || comment.document.organizationId !== organizationId) {
      throw new NotFoundException('Comment not found');
    }

    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        isResolved: resolved,
        resolvedById: resolved ? userId : null,
        resolvedAt: resolved ? new Date() : null,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        resolvedBy: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        mentions: true,
        _count: { select: { replies: true } },
      },
    });

    const response = this.toResponse(updated);

    // Emit real-time event
    this.realtimeService.emitToDocument(comment.documentId, 'comment:resolved', {
      comment: response,
      resolved,
    });

    return response;
  }

  /**
   * Delete a comment
   */
  async delete(commentId: string, userId: string, organizationId: string): Promise<void> {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId },
      include: {
        document: { select: { organizationId: true } },
      },
    });

    if (!comment || comment.document.organizationId !== organizationId) {
      throw new NotFoundException('Comment not found');
    }

    // Check if user is author or has admin/owner role
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        role: { in: ['ADMIN', 'OWNER'] },
      },
    });

    if (comment.authorId !== userId && !membership) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.prisma.comment.delete({
      where: { id: commentId },
    });

    // Emit real-time event
    this.realtimeService.emitToDocument(comment.documentId, 'comment:deleted', {
      commentId,
      documentId: comment.documentId,
    });
  }

  /**
   * Get comment count for a document
   */
  async getCount(documentId: string, organizationId: string): Promise<{ total: number; resolved: number }> {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const [total, resolved] = await Promise.all([
      this.prisma.comment.count({ where: { documentId } }),
      this.prisma.comment.count({ where: { documentId, isResolved: true } }),
    ]);

    return { total, resolved };
  }
}
