import { IsString, IsOptional, IsBoolean, MinLength, MaxLength, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCommentDto {
  @ApiPropertyOptional({ description: 'Updated comment content' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content?: string;

  @ApiPropertyOptional({ description: 'Updated mentions', type: [String] })
  @IsOptional()
  @IsUUID('4', { each: true })
  mentions?: string[];
}

export class ResolveCommentDto {
  @ApiPropertyOptional({ description: 'Whether to resolve or unresolve the comment' })
  @IsOptional()
  @IsBoolean()
  resolved?: boolean;
}
