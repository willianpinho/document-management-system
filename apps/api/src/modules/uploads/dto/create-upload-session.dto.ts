import { IsString, IsInt, IsOptional, IsUUID, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUploadSessionDto {
  @ApiProperty({ description: 'File name', example: 'document.pdf' })
  @IsString()
  fileName: string;

  @ApiProperty({ description: 'MIME type', example: 'application/pdf' })
  @IsString()
  mimeType: string;

  @ApiProperty({ description: 'Total file size in bytes', example: 10485760 })
  @IsInt()
  @Min(1)
  totalBytes: number;

  @ApiPropertyOptional({ description: 'Chunk size in bytes (default 5MB)', example: 5242880 })
  @IsOptional()
  @IsInt()
  @Min(1024 * 1024) // 1MB minimum
  @Max(100 * 1024 * 1024) // 100MB maximum
  chunkSize?: number;

  @ApiPropertyOptional({ description: 'Target folder ID' })
  @IsOptional()
  @IsUUID()
  folderId?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UploadSessionResponseDto {
  @ApiProperty({ description: 'Upload session ID' })
  id: string;

  @ApiProperty({ description: 'File name' })
  fileName: string;

  @ApiProperty({ description: 'MIME type' })
  mimeType: string;

  @ApiProperty({ description: 'Total file size in bytes' })
  totalBytes: number;

  @ApiProperty({ description: 'Uploaded bytes so far' })
  uploadedBytes: number;

  @ApiProperty({ description: 'Chunk size in bytes' })
  chunkSize: number;

  @ApiProperty({ description: 'Total number of chunks' })
  totalChunks: number;

  @ApiProperty({ description: 'Number of uploaded chunks' })
  uploadedChunks: number;

  @ApiProperty({ description: 'Upload status' })
  status: string;

  @ApiProperty({ description: 'Expiration time' })
  expiresAt: string;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: string;

  @ApiProperty({ description: 'List of uploaded chunk numbers' })
  completedChunks: number[];
}
