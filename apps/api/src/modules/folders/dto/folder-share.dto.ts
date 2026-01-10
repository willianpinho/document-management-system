import { IsString, IsUUID, IsEnum, IsOptional, IsArray, IsBoolean, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SharePermission } from '@prisma/client';

// Re-export for convenience
export { SharePermission };

export class ShareFolderDto {
  @ApiProperty({ description: 'Email of the user to share with' })
  @IsString()
  email: string;

  @ApiProperty({
    description: 'Permission level',
    enum: SharePermission,
  })
  @IsEnum(SharePermission)
  permission: SharePermission;

  @ApiPropertyOptional({ description: 'Whether user can re-share the folder' })
  @IsOptional()
  @IsBoolean()
  canShare?: boolean;
}

export class UpdateFolderShareDto {
  @ApiPropertyOptional({
    description: 'Permission level',
    enum: SharePermission,
  })
  @IsOptional()
  @IsEnum(SharePermission)
  permission?: SharePermission;

  @ApiPropertyOptional({ description: 'Whether user can re-share the folder' })
  @IsOptional()
  @IsBoolean()
  canShare?: boolean;
}

export class CreateFolderShareLinkDto {
  @ApiProperty({
    description: 'Permission level for the link',
    enum: SharePermission,
  })
  @IsEnum(SharePermission)
  permission: SharePermission;

  @ApiPropertyOptional({ description: 'Expiration date for the link' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'Password protection for the link' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'Maximum number of uses for the link' })
  @IsOptional()
  maxUses?: number;
}

export class FolderShareUserDto {
  @ApiProperty({ description: 'User ID' })
  id: string;

  @ApiProperty({ description: 'User email' })
  email: string;

  @ApiPropertyOptional({ description: 'User name' })
  name?: string | null;

  @ApiPropertyOptional({ description: 'User avatar URL' })
  avatarUrl?: string | null;

  @ApiProperty({ description: 'Permission level', enum: SharePermission })
  permission: SharePermission;

  @ApiProperty({ description: 'Whether user can re-share' })
  canShare: boolean;

  @ApiProperty({ description: 'When the share was created' })
  sharedAt: string;
}

export class FolderShareLinkDto {
  @ApiProperty({ description: 'Share link ID' })
  id: string;

  @ApiProperty({ description: 'Share token' })
  token: string;

  @ApiProperty({ description: 'Permission level', enum: SharePermission })
  permission: SharePermission;

  @ApiPropertyOptional({ description: 'Expiration date' })
  expiresAt?: string | null;

  @ApiProperty({ description: 'Whether link is password protected' })
  hasPassword: boolean;

  @ApiPropertyOptional({ description: 'Maximum uses' })
  maxUses?: number | null;

  @ApiProperty({ description: 'Current use count' })
  useCount: number;

  @ApiProperty({ description: 'When the link was created' })
  createdAt: string;
}

export class FolderSharesResponseDto {
  @ApiProperty({ description: 'Users with access', type: [FolderShareUserDto] })
  users: FolderShareUserDto[];

  @ApiPropertyOptional({ description: 'Active share link', type: FolderShareLinkDto })
  link?: FolderShareLinkDto | null;
}

export class InheritedShareDto {
  @ApiProperty({ description: 'Parent folder ID' })
  folderId: string;

  @ApiProperty({ description: 'Parent folder name' })
  folderName: string;

  @ApiProperty({ description: 'Users who have access through inheritance', type: [FolderShareUserDto] })
  users: FolderShareUserDto[];
}
