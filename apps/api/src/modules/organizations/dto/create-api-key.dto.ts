import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsDateString, MinLength, MaxLength } from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({
    description: 'Name for the API key',
    example: 'Production API Key',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Scopes/permissions for the API key',
    example: ['documents:read', 'documents:write'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @ApiPropertyOptional({
    description: 'Expiration date for the API key (ISO 8601)',
    example: '2025-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
