import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CommentAuthorDto {
  @ApiProperty({ description: 'User ID' })
  id: string;

  @ApiProperty({ description: 'User name' })
  name: string | null;

  @ApiProperty({ description: 'User email' })
  email: string;

  @ApiPropertyOptional({ description: 'User avatar URL' })
  avatarUrl?: string | null;
}

export class CommentMentionDto {
  @ApiProperty({ description: 'Mentioned user ID' })
  id: string;

  @ApiProperty({ description: 'Mentioned user name' })
  name: string | null;

  @ApiProperty({ description: 'Mentioned user email' })
  email: string;
}

export class CommentResponseDto {
  @ApiProperty({ description: 'Comment ID' })
  id: string;

  @ApiProperty({ description: 'Document ID' })
  documentId: string;

  @ApiProperty({ description: 'Comment author' })
  author: CommentAuthorDto;

  @ApiPropertyOptional({ description: 'Parent comment ID' })
  parentId: string | null;

  @ApiProperty({ description: 'Comment content' })
  content: string;

  @ApiProperty({ description: 'Whether the comment is resolved' })
  isResolved: boolean;

  @ApiPropertyOptional({ description: 'User who resolved the comment' })
  resolvedBy: CommentAuthorDto | null;

  @ApiPropertyOptional({ description: 'Resolution timestamp' })
  resolvedAt: Date | null;

  @ApiPropertyOptional({ description: 'Edit timestamp' })
  editedAt: Date | null;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Update timestamp' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Page number' })
  pageNumber: number | null;

  @ApiPropertyOptional({ description: 'X position percentage' })
  positionX: number | null;

  @ApiPropertyOptional({ description: 'Y position percentage' })
  positionY: number | null;

  @ApiPropertyOptional({ description: 'Text selection start' })
  selectionStart: number | null;

  @ApiPropertyOptional({ description: 'Text selection end' })
  selectionEnd: number | null;

  @ApiProperty({ description: 'Mentioned users', type: [CommentMentionDto] })
  mentions: CommentMentionDto[];

  @ApiProperty({ description: 'Reply count' })
  replyCount: number;

  @ApiPropertyOptional({ description: 'Replies (when expanded)', type: [CommentResponseDto] })
  replies?: CommentResponseDto[];
}

export class CommentListResponseDto {
  @ApiProperty({ description: 'List of comments', type: [CommentResponseDto] })
  data: CommentResponseDto[];

  @ApiProperty({ description: 'Total count' })
  total: number;

  @ApiProperty({ description: 'Current page' })
  page: number;

  @ApiProperty({ description: 'Page size' })
  limit: number;

  @ApiProperty({ description: 'Total pages' })
  totalPages: number;
}
