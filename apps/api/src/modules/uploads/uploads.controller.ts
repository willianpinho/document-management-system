import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UploadsService } from './uploads.service';
import {
  CreateUploadSessionDto,
  UploadSessionResponseDto,
  UploadChunkResponseDto,
  CompleteUploadResponseDto,
  ChunkPresignedUrlDto,
} from './dto';

interface AuthUser {
  id: string;
  email: string;
  organizationId: string;
}

class ConfirmChunkDto {
  etag: string;
  sizeBytes: number;
}

@ApiTags('uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('sessions')
  @ApiOperation({ summary: 'Create a new upload session for resumable upload' })
  @ApiResponse({ status: 201, type: UploadSessionResponseDto })
  async createSession(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateUploadSessionDto,
  ): Promise<UploadSessionResponseDto> {
    return this.uploadsService.createSession(
      user.id,
      user.organizationId,
      dto,
    );
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List active upload sessions' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiResponse({ status: 200, type: [UploadSessionResponseDto] })
  async listSessions(
    @CurrentUser() user: AuthUser,
    @Query('userId') userId?: string,
  ): Promise<UploadSessionResponseDto[]> {
    return this.uploadsService.listSessions(
      user.organizationId,
      userId,
    );
  }

  @Get('sessions/:sessionId')
  @ApiOperation({ summary: 'Get an upload session' })
  @ApiParam({ name: 'sessionId', description: 'Upload session ID' })
  @ApiResponse({ status: 200, type: UploadSessionResponseDto })
  async getSession(
    @CurrentUser() user: AuthUser,
    @Param('sessionId') sessionId: string,
  ): Promise<UploadSessionResponseDto> {
    return this.uploadsService.getSession(sessionId, user.organizationId);
  }

  @Get('sessions/:sessionId/chunks/:chunkNumber/url')
  @ApiOperation({ summary: 'Get presigned URL for uploading a chunk' })
  @ApiParam({ name: 'sessionId', description: 'Upload session ID' })
  @ApiParam({ name: 'chunkNumber', description: 'Chunk number (0-indexed)' })
  @ApiResponse({ status: 200, type: ChunkPresignedUrlDto })
  async getChunkUploadUrl(
    @CurrentUser() user: AuthUser,
    @Param('sessionId') sessionId: string,
    @Param('chunkNumber', ParseIntPipe) chunkNumber: number,
  ): Promise<ChunkPresignedUrlDto> {
    return this.uploadsService.getChunkUploadUrl(
      sessionId,
      user.organizationId,
      chunkNumber,
    );
  }

  @Patch('sessions/:sessionId/chunks/:chunkNumber')
  @ApiOperation({ summary: 'Confirm a chunk has been uploaded' })
  @ApiParam({ name: 'sessionId', description: 'Upload session ID' })
  @ApiParam({ name: 'chunkNumber', description: 'Chunk number (0-indexed)' })
  @ApiResponse({ status: 200, type: UploadChunkResponseDto })
  async confirmChunk(
    @CurrentUser() user: AuthUser,
    @Param('sessionId') sessionId: string,
    @Param('chunkNumber', ParseIntPipe) chunkNumber: number,
    @Body() dto: ConfirmChunkDto,
  ): Promise<UploadChunkResponseDto> {
    return this.uploadsService.confirmChunk(
      sessionId,
      user.organizationId,
      chunkNumber,
      dto.etag,
      dto.sizeBytes,
    );
  }

  @Post('sessions/:sessionId/complete')
  @ApiOperation({ summary: 'Complete the upload and create the document' })
  @ApiParam({ name: 'sessionId', description: 'Upload session ID' })
  @ApiResponse({ status: 201, type: CompleteUploadResponseDto })
  async completeUpload(
    @CurrentUser() user: AuthUser,
    @Param('sessionId') sessionId: string,
  ): Promise<CompleteUploadResponseDto> {
    return this.uploadsService.completeUpload(
      sessionId,
      user.id,
      user.organizationId,
    );
  }

  @Delete('sessions/:sessionId')
  @ApiOperation({ summary: 'Cancel an upload session' })
  @ApiParam({ name: 'sessionId', description: 'Upload session ID' })
  @ApiResponse({ status: 204 })
  async cancelUpload(
    @CurrentUser() user: AuthUser,
    @Param('sessionId') sessionId: string,
  ): Promise<void> {
    return this.uploadsService.cancelUpload(sessionId, user.organizationId);
  }
}
