import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength, IsOptional, IsObject } from 'class-validator';

export class UpdateOrganizationDto {
  @ApiPropertyOptional({
    description: 'Organization name',
    example: 'Acme Corporation Updated',
    minLength: 2,
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: 'Organization settings',
    example: { defaultLanguage: 'en', theme: 'dark' },
  })
  @IsObject()
  @IsOptional()
  settings?: Record<string, unknown>;
}
