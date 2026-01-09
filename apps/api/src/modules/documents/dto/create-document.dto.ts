import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsUUID, Min, Max, Matches } from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty({ example: 'document.pdf' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  @Matches(/^[a-z]+\/[a-z0-9.+-]+$/i, { message: 'Invalid MIME type format' })
  mimeType: string;

  @ApiProperty({ example: 1024 })
  @IsNumber()
  @Min(1)
  @Max(5 * 1024 * 1024 * 1024) // 5GB
  sizeBytes: number;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  folderId?: string;
}
