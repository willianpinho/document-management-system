import { IsArray, IsUUID, IsOptional, IsString, ValidateNested, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum BulkOperationType {
  DELETE = 'DELETE',
  MOVE = 'MOVE',
  COPY = 'COPY',
  DOWNLOAD = 'DOWNLOAD',
}

export class BulkDeleteDto {
  @ApiProperty({
    description: 'Array of document IDs to delete',
    example: ['uuid-1', 'uuid-2'],
  })
  @IsArray()
  @IsUUID(4, { each: true })
  documentIds: string[];

  @ApiPropertyOptional({
    description: 'Array of folder IDs to delete',
    example: ['uuid-3'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  folderIds?: string[];

  @ApiPropertyOptional({
    description: 'Whether to permanently delete (bypass trash)',
    default: false,
  })
  @IsOptional()
  permanent?: boolean;
}

export class BulkMoveDto {
  @ApiProperty({
    description: 'Array of document IDs to move',
    example: ['uuid-1', 'uuid-2'],
  })
  @IsArray()
  @IsUUID(4, { each: true })
  documentIds: string[];

  @ApiPropertyOptional({
    description: 'Array of folder IDs to move',
    example: ['uuid-3'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  folderIds?: string[];

  @ApiProperty({
    description: 'Target folder ID (null for root)',
    example: 'target-folder-uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID(4)
  targetFolderId: string | null;
}

export class BulkCopyDto {
  @ApiProperty({
    description: 'Array of document IDs to copy',
    example: ['uuid-1', 'uuid-2'],
  })
  @IsArray()
  @IsUUID(4, { each: true })
  documentIds: string[];

  @ApiProperty({
    description: 'Target folder ID (null for root)',
    example: 'target-folder-uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID(4)
  targetFolderId: string | null;
}

export class BulkDownloadDto {
  @ApiProperty({
    description: 'Array of document IDs to download',
    example: ['uuid-1', 'uuid-2'],
  })
  @IsArray()
  @IsUUID(4, { each: true })
  documentIds: string[];

  @ApiPropertyOptional({
    description: 'Array of folder IDs to download (will include all contents)',
    example: ['uuid-3'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  folderIds?: string[];
}

export class BulkOperationResultItem {
  @ApiProperty({ description: 'Item ID' })
  id: string;

  @ApiProperty({ description: 'Whether the operation succeeded' })
  success: boolean;

  @ApiPropertyOptional({ description: 'Error message if failed' })
  error?: string;
}

export class BulkOperationResult {
  @ApiProperty({ description: 'Total number of items processed' })
  total: number;

  @ApiProperty({ description: 'Number of successful operations' })
  successful: number;

  @ApiProperty({ description: 'Number of failed operations' })
  failed: number;

  @ApiProperty({
    description: 'Individual item results',
    type: [BulkOperationResultItem],
  })
  results: BulkOperationResultItem[];
}

export class BulkDownloadResult {
  @ApiProperty({ description: 'Presigned URL to download the zip file' })
  downloadUrl: string;

  @ApiProperty({ description: 'URL expiration time in seconds' })
  expiresIn: number;

  @ApiProperty({ description: 'Number of files included' })
  fileCount: number;

  @ApiProperty({ description: 'Total size in bytes' })
  totalSizeBytes: number;
}
