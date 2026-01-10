import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { FoldersService } from './folders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationGuard } from '@/common/guards/organization.guard';
import { CurrentUser, CurrentUserPayload } from '@/common/decorators/current-user.decorator';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { AuditFolder, AuditAction } from '../audit';
import {
  ShareFolderDto,
  UpdateFolderShareDto,
  CreateFolderShareLinkDto,
  FolderSharesResponseDto,
  FolderShareUserDto,
  FolderShareLinkDto,
} from './dto/folder-share.dto';
import { SharePermission } from '@prisma/client';

@ApiTags('folders')
@Controller('folders')
@UseGuards(JwtAuthGuard, OrganizationGuard)
@ApiBearerAuth('JWT-auth')
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Get()
  @AuditFolder(AuditAction.FOLDER_READ, { includeQuery: true })
  @ApiOperation({
    summary: 'List folders',
    description: 'Get all folders at a specific level (root if no parentId)',
  })
  @ApiQuery({ name: 'parentId', required: false, description: 'Parent folder ID' })
  @ApiResponse({ status: 200, description: 'List of folders' })
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('parentId') parentId?: string,
  ) {
    return this.foldersService.findAll(user.organizationId!, parentId);
  }

  @Post()
  @AuditFolder(AuditAction.FOLDER_CREATE, { includeBody: true })
  @ApiOperation({
    summary: 'Create folder',
    description: 'Create a new folder in the organization',
  })
  @ApiResponse({ status: 201, description: 'Folder created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'Parent folder not found' })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() createFolderDto: CreateFolderDto,
  ) {
    return this.foldersService.create({
      ...createFolderDto,
      organizationId: user.organizationId!,
      createdById: user.id,
    });
  }

  @Get('tree')
  @ApiOperation({
    summary: 'Get full folder tree',
    description: 'Get complete hierarchical tree structure of all folders in the organization',
  })
  @ApiResponse({ status: 200, description: 'Complete folder tree structure' })
  async getFullTree(@CurrentUser() user: CurrentUserPayload) {
    return this.foldersService.getFullTree(user.organizationId!);
  }

  @Get(':id')
  @AuditFolder(AuditAction.FOLDER_READ)
  @ApiOperation({
    summary: 'Get folder with contents',
    description: 'Get folder details including subfolders and documents',
  })
  @ApiParam({ name: 'id', description: 'Folder ID' })
  @ApiResponse({ status: 200, description: 'Folder details' })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  async findOne(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.foldersService.findOne(id, user.organizationId!);
  }

  @Patch(':id')
  @AuditFolder(AuditAction.FOLDER_UPDATE, { includeBody: true })
  @ApiOperation({
    summary: 'Update folder',
    description: 'Update folder name or move to different parent',
  })
  @ApiParam({ name: 'id', description: 'Folder ID' })
  @ApiResponse({ status: 200, description: 'Folder updated' })
  @ApiResponse({ status: 400, description: 'Invalid operation' })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() updateFolderDto: UpdateFolderDto,
  ) {
    return this.foldersService.update(id, user.organizationId!, updateFolderDto);
  }

  @Delete(':id')
  @AuditFolder(AuditAction.FOLDER_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete folder',
    description: 'Delete an empty folder',
  })
  @ApiParam({ name: 'id', description: 'Folder ID' })
  @ApiResponse({ status: 204, description: 'Folder deleted' })
  @ApiResponse({ status: 400, description: 'Folder is not empty' })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  async remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.foldersService.remove(id, user.organizationId!);
  }

  @Get(':id/tree')
  @ApiOperation({
    summary: 'Get folder tree',
    description: 'Get hierarchical tree structure starting from folder',
  })
  @ApiParam({ name: 'id', description: 'Folder ID' })
  @ApiResponse({ status: 200, description: 'Folder tree structure' })
  async getTree(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.foldersService.getTree(id, user.organizationId!);
  }

  @Get(':id/breadcrumbs')
  @ApiOperation({
    summary: 'Get breadcrumbs',
    description: 'Get breadcrumb path from root to folder',
  })
  @ApiParam({ name: 'id', description: 'Folder ID' })
  @ApiResponse({ status: 200, description: 'Breadcrumb path' })
  async getBreadcrumbs(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.foldersService.getBreadcrumbs(id, user.organizationId!);
  }

  // ==================== Folder Sharing Endpoints ====================

  @Get(':id/shares')
  @ApiOperation({
    summary: 'Get folder shares',
    description: 'Get all users and links with access to this folder',
  })
  @ApiParam({ name: 'id', description: 'Folder ID' })
  @ApiResponse({ status: 200, description: 'Folder shares', type: FolderSharesResponseDto })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  async getShares(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<FolderSharesResponseDto> {
    return this.foldersService.getShares(id, user.organizationId!);
  }

  @Post(':id/shares')
  @AuditFolder(AuditAction.FOLDER_SHARE, { includeBody: true })
  @ApiOperation({
    summary: 'Share folder with user',
    description: 'Share folder with a user by email',
  })
  @ApiParam({ name: 'id', description: 'Folder ID' })
  @ApiResponse({ status: 201, description: 'Folder shared', type: FolderShareUserDto })
  @ApiResponse({ status: 400, description: 'Invalid input or user already has access' })
  @ApiResponse({ status: 404, description: 'Folder or user not found' })
  async shareWithUser(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() shareDto: ShareFolderDto,
  ): Promise<FolderShareUserDto> {
    return this.foldersService.shareWithUser(
      id,
      user.organizationId!,
      shareDto.email,
      shareDto.permission,
      user.id,
      shareDto.canShare,
    );
  }

  @Patch(':id/shares/:userId')
  @AuditFolder(AuditAction.FOLDER_UPDATE, { includeBody: true })
  @ApiOperation({
    summary: 'Update share permission',
    description: 'Update permission level for a shared user',
  })
  @ApiParam({ name: 'id', description: 'Folder ID' })
  @ApiParam({ name: 'userId', description: 'User ID to update' })
  @ApiResponse({ status: 200, description: 'Share updated', type: FolderShareUserDto })
  @ApiResponse({ status: 404, description: 'Share not found' })
  async updateShare(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() updateDto: UpdateFolderShareDto,
  ): Promise<FolderShareUserDto> {
    return this.foldersService.updateShare(
      id,
      user.organizationId!,
      userId,
      updateDto.permission,
      updateDto.canShare,
    );
  }

  @Delete(':id/shares/:userId')
  @AuditFolder(AuditAction.FOLDER_UNSHARE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove share',
    description: 'Remove user access from folder',
  })
  @ApiParam({ name: 'id', description: 'Folder ID' })
  @ApiParam({ name: 'userId', description: 'User ID to remove' })
  @ApiResponse({ status: 204, description: 'Share removed' })
  @ApiResponse({ status: 404, description: 'Share not found' })
  async removeShare(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    await this.foldersService.removeShare(id, user.organizationId!, userId);
  }

  @Post(':id/share-link')
  @AuditFolder(AuditAction.FOLDER_SHARE, { includeBody: true })
  @ApiOperation({
    summary: 'Create share link',
    description: 'Create a shareable link for the folder',
  })
  @ApiParam({ name: 'id', description: 'Folder ID' })
  @ApiResponse({ status: 201, description: 'Share link created', type: FolderShareLinkDto })
  @ApiResponse({ status: 400, description: 'Share link already exists' })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  async createShareLink(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() createLinkDto: CreateFolderShareLinkDto,
  ): Promise<FolderShareLinkDto> {
    return this.foldersService.createShareLink(
      id,
      user.organizationId!,
      createLinkDto.permission,
      user.id,
      createLinkDto.expiresAt ? new Date(createLinkDto.expiresAt) : undefined,
      createLinkDto.password,
      createLinkDto.maxUses,
    );
  }

  @Delete(':id/share-link')
  @AuditFolder(AuditAction.FOLDER_UNSHARE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete share link',
    description: 'Delete the shareable link for the folder',
  })
  @ApiParam({ name: 'id', description: 'Folder ID' })
  @ApiResponse({ status: 204, description: 'Share link deleted' })
  @ApiResponse({ status: 404, description: 'Share link not found' })
  async deleteShareLink(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.foldersService.deleteShareLink(id, user.organizationId!);
  }

  @Get(':id/inherited-shares')
  @ApiOperation({
    summary: 'Get inherited shares',
    description: 'Get shares inherited from parent folders',
  })
  @ApiParam({ name: 'id', description: 'Folder ID' })
  @ApiResponse({ status: 200, description: 'Inherited shares' })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  async getInheritedShares(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.foldersService.getInheritedShares(id, user.organizationId!);
  }
}
