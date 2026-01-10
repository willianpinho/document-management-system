import { IsString, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadChunkParamsDto {
  @ApiProperty({ description: 'Upload session ID' })
  sessionId: string;

  @ApiProperty({ description: 'Chunk number (0-indexed)' })
  chunkNumber: string;
}

export class UploadChunkResponseDto {
  @ApiProperty({ description: 'Whether the chunk was uploaded successfully' })
  success: boolean;

  @ApiProperty({ description: 'Chunk number that was uploaded' })
  chunkNumber: number;

  @ApiProperty({ description: 'Size of the chunk in bytes' })
  sizeBytes: number;

  @ApiProperty({ description: 'Total uploaded bytes so far' })
  uploadedBytes: number;

  @ApiProperty({ description: 'Total number of uploaded chunks' })
  uploadedChunks: number;

  @ApiProperty({ description: 'Whether all chunks have been uploaded' })
  isComplete: boolean;
}

export class CompleteUploadResponseDto {
  @ApiProperty({ description: 'Whether the upload was completed successfully' })
  success: boolean;

  @ApiProperty({ description: 'Created document ID' })
  documentId: string;

  @ApiProperty({ description: 'Document name' })
  name: string;

  @ApiProperty({ description: 'Final S3 key' })
  s3Key: string;
}

export class ChunkPresignedUrlDto {
  @ApiProperty({ description: 'Presigned URL for uploading the chunk' })
  uploadUrl: string;

  @ApiProperty({ description: 'Chunk number' })
  chunkNumber: number;

  @ApiProperty({ description: 'URL expiration time in seconds' })
  expiresIn: number;
}
