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
}
