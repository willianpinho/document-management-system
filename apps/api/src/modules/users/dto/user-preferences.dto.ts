import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString, IsOptional, IsIn } from 'class-validator';

export class NotificationPreferencesDto {
  @ApiProperty({ description: 'Email notifications for document uploads', default: true })
  @IsBoolean()
  @IsOptional()
  emailOnUpload?: boolean;

  @ApiProperty({ description: 'Email notifications for document processing completion', default: true })
  @IsBoolean()
  @IsOptional()
  emailOnProcessingComplete?: boolean;

  @ApiProperty({ description: 'Email notifications for document sharing', default: true })
  @IsBoolean()
  @IsOptional()
  emailOnShare?: boolean;

  @ApiProperty({ description: 'Email notifications for comments and mentions', default: true })
  @IsBoolean()
  @IsOptional()
  emailOnComments?: boolean;

  @ApiProperty({ description: 'Weekly digest email', default: false })
  @IsBoolean()
  @IsOptional()
  weeklyDigest?: boolean;

  @ApiProperty({ description: 'Marketing and product update emails', default: false })
  @IsBoolean()
  @IsOptional()
  marketingEmails?: boolean;
}

export class AppearancePreferencesDto {
  @ApiProperty({ description: 'Theme preference', enum: ['light', 'dark', 'system'], default: 'system' })
  @IsString()
  @IsOptional()
  @IsIn(['light', 'dark', 'system'])
  theme?: 'light' | 'dark' | 'system';

  @ApiProperty({ description: 'Accent color', enum: ['blue', 'green', 'purple', 'orange', 'red'], default: 'blue' })
  @IsString()
  @IsOptional()
  @IsIn(['blue', 'green', 'purple', 'orange', 'red'])
  accentColor?: 'blue' | 'green' | 'purple' | 'orange' | 'red';

  @ApiProperty({ description: 'Use compact mode', default: false })
  @IsBoolean()
  @IsOptional()
  compactMode?: boolean;
}

export class UserPreferencesDto {
  @ApiProperty({ description: 'Notification preferences', type: NotificationPreferencesDto })
  @IsOptional()
  notifications?: NotificationPreferencesDto;

  @ApiProperty({ description: 'Appearance preferences', type: AppearancePreferencesDto })
  @IsOptional()
  appearance?: AppearancePreferencesDto;
}

// Default preferences
export const defaultUserPreferences: UserPreferencesDto = {
  notifications: {
    emailOnUpload: true,
    emailOnProcessingComplete: true,
    emailOnShare: true,
    emailOnComments: true,
    weeklyDigest: false,
    marketingEmails: false,
  },
  appearance: {
    theme: 'system',
    accentColor: 'blue',
    compactMode: false,
  },
};
