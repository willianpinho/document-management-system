import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { MemberRole } from './invite-member.dto';

// Re-export for convenience
export { MemberRole };

export class UpdateMemberRoleDto {
  @ApiProperty({
    description: 'New role for the member',
    enum: MemberRole,
    example: MemberRole.EDITOR,
  })
  @IsEnum(MemberRole)
  role: MemberRole;
}
