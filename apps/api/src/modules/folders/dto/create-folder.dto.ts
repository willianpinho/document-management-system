import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, IsOptional, IsUUID } from 'class-validator';

export class CreateFolderDto {
  @ApiProperty({
    description: 'Folder name',
    example: 'Project Documents',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: 'Parent folder ID (null for root level)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  parentId?: string;
}
