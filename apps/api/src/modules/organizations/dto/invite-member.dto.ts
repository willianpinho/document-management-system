import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional } from 'class-validator';

export enum MemberRole {
  VIEWER = 'VIEWER',
  EDITOR = 'EDITOR',
  ADMIN = 'ADMIN',
  OWNER = 'OWNER',
}

export class InviteMemberDto {
  @ApiProperty({
    description: 'Email of the user to invite',
    example: 'newuser@example.com',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: 'Role to assign to the member',
    enum: MemberRole,
    default: MemberRole.VIEWER,
  })
  @IsEnum(MemberRole)
  @IsOptional()
  role?: MemberRole = MemberRole.VIEWER;
}
