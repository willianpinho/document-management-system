import {
  Controller,
  Get,
  Put,
  Patch,
  Delete,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserPreferencesDto } from './dto/user-preferences.dto';
import { AuditLog, AuditAction, AuditResourceType } from '../audit';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user' })
  async getCurrentUser(@Request() req: { user: { id: string } }) {
    return this.usersService.findById(req.user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user' })
  async updateCurrentUser(
    @Request() req: { user: { id: string } },
    @Body() updateData: { name?: string; avatarUrl?: string },
  ) {
    return this.usersService.update(req.user.id, updateData);
  }

  @Get('me/preferences')
  @ApiOperation({ summary: 'Get user preferences' })
  @ApiResponse({ status: 200, description: 'User preferences retrieved successfully' })
  async getPreferences(@Request() req: { user: { id: string } }) {
    return this.usersService.getPreferences(req.user.id);
  }

  @Put('me/preferences')
  @ApiOperation({ summary: 'Update user preferences' })
  @ApiResponse({ status: 200, description: 'User preferences updated successfully' })
  async updatePreferences(
    @Request() req: { user: { id: string } },
    @Body() preferences: UserPreferencesDto,
  ) {
    return this.usersService.updatePreferences(req.user.id, preferences);
  }

  @Get('me/export')
  @AuditLog({ action: AuditAction.DATA_EXPORT, resourceType: AuditResourceType.USER })
  @ApiOperation({ summary: 'Export user data' })
  @ApiResponse({ status: 200, description: 'User data exported successfully' })
  async exportData(@Request() req: { user: { id: string } }) {
    return this.usersService.exportUserData(req.user.id);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @AuditLog({ action: AuditAction.ACCOUNT_DELETE, resourceType: AuditResourceType.USER })
  @ApiOperation({ summary: 'Delete user account' })
  @ApiResponse({ status: 200, description: 'User account deleted successfully' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async deleteAccount(@Request() req: { user: { id: string } }) {
    return this.usersService.deleteAccount(req.user.id);
  }
}
