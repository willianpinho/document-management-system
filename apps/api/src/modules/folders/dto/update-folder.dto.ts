import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, IsOptional, IsUUID } from 'class-validator';

export class UpdateFolderDto {
  @ApiPropertyOptional({
    description: 'New folder name',
    example: 'Renamed Folder',
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: 'New parent folder ID (null to move to root)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  parentId?: string | null;
}
