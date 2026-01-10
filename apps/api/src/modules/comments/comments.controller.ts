import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseIntPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { CurrentUser, CurrentUserPayload } from '@/common/decorators/current-user.decorator';
import { CommentsService } from './comments.service';
import {
  CreateCommentDto,
  UpdateCommentDto,
  ResolveCommentDto,
  CommentResponseDto,
  CommentListResponseDto,
} from './dto';
import { AuditLog, AuditAction, AuditResourceType } from '../audit';

@ApiTags('comments')
@ApiBearerAuth('JWT-auth')
@Controller('documents/:documentId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @AuditLog({
    action: AuditAction.DOCUMENT_UPDATE,
    resourceType: AuditResourceType.DOCUMENT,
    resourceIdParam: 'documentId',
  })
  @ApiOperation({ summary: 'Create a comment on a document' })
  @ApiParam({ name: 'documentId', description: 'Document ID' })
  @ApiResponse({ status: 201, description: 'Comment created', type: CommentResponseDto })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async create(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<CommentResponseDto> {
    return this.commentsService.create(documentId, user.id, user.organizationId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all comments for a document' })
  @ApiParam({ name: 'documentId', description: 'Document ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size', example: 50 })
  @ApiQuery({ name: 'includeReplies', required: false, description: 'Include replies' })
  @ApiResponse({ status: 200, description: 'List of comments', type: CommentListResponseDto })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async findAll(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('includeReplies', new DefaultValuePipe(true), ParseBoolPipe) includeReplies: boolean,
  ): Promise<CommentListResponseDto> {
    return this.commentsService.findAll({
      documentId,
      organizationId: user.organizationId,
      page,
      limit,
      includeReplies,
    });
  }

  @Get('count')
  @ApiOperation({ summary: 'Get comment count for a document' })
  @ApiParam({ name: 'documentId', description: 'Document ID' })
  @ApiResponse({ status: 200, description: 'Comment count' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async getCount(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ total: number; resolved: number }> {
    return this.commentsService.getCount(documentId, user.organizationId);
  }

  @Get(':commentId')
  @ApiOperation({ summary: 'Get a single comment' })
  @ApiParam({ name: 'documentId', description: 'Document ID' })
  @ApiParam({ name: 'commentId', description: 'Comment ID' })
  @ApiResponse({ status: 200, description: 'Comment details', type: CommentResponseDto })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async findOne(
    @Param('documentId', ParseUUIDPipe) _documentId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<CommentResponseDto> {
    return this.commentsService.findOne(commentId, user.organizationId);
  }

  @Patch(':commentId')
  @AuditLog({
    action: AuditAction.DOCUMENT_UPDATE,
    resourceType: AuditResourceType.DOCUMENT,
    resourceIdParam: 'documentId',
  })
  @ApiOperation({ summary: 'Update a comment' })
  @ApiParam({ name: 'documentId', description: 'Document ID' })
  @ApiParam({ name: 'commentId', description: 'Comment ID' })
  @ApiResponse({ status: 200, description: 'Comment updated', type: CommentResponseDto })
  @ApiResponse({ status: 403, description: 'Not authorized to edit this comment' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async update(
    @Param('documentId', ParseUUIDPipe) _documentId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<CommentResponseDto> {
    return this.commentsService.update(commentId, user.id, user.organizationId, dto);
  }

  @Patch(':commentId/resolve')
  @AuditLog({
    action: AuditAction.DOCUMENT_UPDATE,
    resourceType: AuditResourceType.DOCUMENT,
    resourceIdParam: 'documentId',
  })
  @ApiOperation({ summary: 'Resolve or unresolve a comment' })
  @ApiParam({ name: 'documentId', description: 'Document ID' })
  @ApiParam({ name: 'commentId', description: 'Comment ID' })
  @ApiResponse({ status: 200, description: 'Comment resolved/unresolved', type: CommentResponseDto })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async resolve(
    @Param('documentId', ParseUUIDPipe) _documentId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: ResolveCommentDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<CommentResponseDto> {
    return this.commentsService.resolve(commentId, user.id, user.organizationId, dto.resolved ?? true);
  }

  @Delete(':commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditLog({
    action: AuditAction.DOCUMENT_UPDATE,
    resourceType: AuditResourceType.DOCUMENT,
    resourceIdParam: 'documentId',
  })
  @ApiOperation({ summary: 'Delete a comment' })
  @ApiParam({ name: 'documentId', description: 'Document ID' })
  @ApiParam({ name: 'commentId', description: 'Comment ID' })
  @ApiResponse({ status: 204, description: 'Comment deleted' })
  @ApiResponse({ status: 403, description: 'Not authorized to delete this comment' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async delete(
    @Param('documentId', ParseUUIDPipe) _documentId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<void> {
    await this.commentsService.delete(commentId, user.id, user.organizationId);
  }
}
