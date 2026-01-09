import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { OrganizationGuard } from '@/common/guards/organization.guard';
import { CurrentUser, CurrentUserPayload } from '@/common/decorators/current-user.decorator';
import { Roles, Role } from '@/common/decorators/roles.decorator';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import {
  AuditOrganization,
  AuditLog,
  AuditAction,
  AuditResourceType,
} from '../audit';

@ApiTags('organizations')
@Controller('organizations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @AuditOrganization(AuditAction.ORGANIZATION_CREATE, { includeBody: true })
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiResponse({ status: 201, description: 'Organization created successfully' })
  @ApiResponse({ status: 409, description: 'Organization slug already exists' })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() createDto: CreateOrganizationDto,
  ) {
    return this.organizationsService.create(createDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all organizations for current user' })
  @ApiResponse({ status: 200, description: 'List of organizations' })
  async findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.organizationsService.findByUserId(user.id);
  }

  @Get(':id')
  @UseGuards(OrganizationGuard)
  @ApiOperation({ summary: 'Get organization by ID' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'Organization details' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async findOne(@Param('id') id: string) {
    return this.organizationsService.findById(id);
  }

  @Patch(':id')
  @UseGuards(OrganizationGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @AuditOrganization(AuditAction.ORGANIZATION_UPDATE, { includeBody: true })
  @ApiOperation({ summary: 'Update organization' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'Organization updated' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateOrganizationDto) {
    return this.organizationsService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(OrganizationGuard, RolesGuard)
  @Roles(Role.OWNER)
  @AuditOrganization(AuditAction.ORGANIZATION_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete organization' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 204, description: 'Organization deleted' })
  @ApiResponse({ status: 403, description: 'Only owner can delete organization' })
  async delete(@Param('id') id: string) {
    return this.organizationsService.delete(id);
  }

  @Get(':id/storage')
  @UseGuards(OrganizationGuard)
  @ApiOperation({ summary: 'Get storage usage' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'Storage usage information' })
  async getStorageUsage(@Param('id') id: string) {
    return this.organizationsService.getStorageUsage(id);
  }

  @Get(':id/members')
  @UseGuards(OrganizationGuard)
  @ApiOperation({ summary: 'Get organization members' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'List of members' })
  async getMembers(@Param('id') id: string) {
    return this.organizationsService.getMembers(id);
  }

  @Post(':id/members')
  @UseGuards(OrganizationGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @AuditLog({
    action: AuditAction.MEMBER_INVITE,
    resourceType: AuditResourceType.ORGANIZATION,
    resourceIdParam: 'id',
    includeBody: true,
  })
  @ApiOperation({ summary: 'Invite a member' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 201, description: 'Member invited successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'User is already a member' })
  async inviteMember(@Param('id') id: string, @Body() inviteDto: InviteMemberDto) {
    return this.organizationsService.inviteMember(id, inviteDto.email, inviteDto.role || 'VIEWER');
  }

  @Patch(':id/members/:memberId')
  @UseGuards(OrganizationGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @AuditLog({
    action: AuditAction.MEMBER_ROLE_CHANGE,
    resourceType: AuditResourceType.ORGANIZATION,
    resourceIdParam: 'id',
    includeBody: true,
  })
  @ApiOperation({ summary: 'Update member role' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiParam({ name: 'memberId', description: 'Member user ID' })
  @ApiResponse({ status: 200, description: 'Member role updated' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async updateMemberRole(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() updateDto: UpdateMemberRoleDto,
  ) {
    return this.organizationsService.updateMemberRole(id, memberId, updateDto.role, user.id);
  }

  @Delete(':id/members/:memberId')
  @UseGuards(OrganizationGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @AuditLog({
    action: AuditAction.MEMBER_REMOVE,
    resourceType: AuditResourceType.ORGANIZATION,
    resourceIdParam: 'id',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiParam({ name: 'memberId', description: 'Member user ID' })
  @ApiResponse({ status: 204, description: 'Member removed' })
  @ApiResponse({ status: 403, description: 'Cannot remove owner' })
  async removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.organizationsService.removeMember(id, memberId, user.id);
  }

  @Post(':id/leave')
  @UseGuards(OrganizationGuard)
  @AuditLog({
    action: AuditAction.MEMBER_LEAVE,
    resourceType: AuditResourceType.ORGANIZATION,
    resourceIdParam: 'id',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave organization' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 204, description: 'Left organization' })
  @ApiResponse({ status: 403, description: 'Owner cannot leave' })
  async leave(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.organizationsService.leaveOrganization(id, user.id);
  }
}
