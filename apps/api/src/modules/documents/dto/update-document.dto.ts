import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsObject } from 'class-validator';

export class UpdateDocumentDto {
  @ApiPropertyOptional({ example: 'new-name.pdf' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  folderId?: string | null;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
