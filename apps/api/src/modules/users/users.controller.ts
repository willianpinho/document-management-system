import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
}
