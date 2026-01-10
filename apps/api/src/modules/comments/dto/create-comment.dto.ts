import { IsString, IsOptional, IsUUID, IsInt, IsNumber, Min, Max, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ description: 'Comment content', example: 'This section needs revision' })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content: string;

  @ApiPropertyOptional({ description: 'Parent comment ID for replies' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Page number for annotation', example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  pageNumber?: number;

  @ApiPropertyOptional({ description: 'X position percentage (0-100)', example: 50.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  positionX?: number;

  @ApiPropertyOptional({ description: 'Y position percentage (0-100)', example: 25.3 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  positionY?: number;

  @ApiPropertyOptional({ description: 'Text selection start position' })
  @IsOptional()
  @IsInt()
  @Min(0)
  selectionStart?: number;

  @ApiPropertyOptional({ description: 'Text selection end position' })
  @IsOptional()
  @IsInt()
  @Min(0)
  selectionEnd?: number;

  @ApiPropertyOptional({ description: 'User IDs to mention', type: [String] })
  @IsOptional()
  @IsUUID('4', { each: true })
  mentions?: string[];
}
