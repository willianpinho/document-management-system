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
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';

import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationGuard } from '@/common/guards/organization.guard';
import { CurrentUser, CurrentUserPayload } from '@/common/decorators/current-user.decorator';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { ProcessingService } from '../processing/processing.service';
import { PdfService } from '../processing/services/pdf.service';
import {
  AuditDocument,
  AuditLog,
  AuditAction,
  AuditResourceType,
} from '../audit';
import {
  SplitDocumentRequestDto,
  MergeDocumentsRequestDto,
  AddWatermarkRequestDto,
  CompressDocumentRequestDto,
  ExtractPagesRequestDto,
  RenderPageRequestDto,
} from '../processing/dto/pdf-options.dto';
import {
  PdfMetadataDto,
  SplitResultDto,
  MergeResultDto,
} from '../processing/dto/pdf-result.dto';
import {
  BulkDeleteDto,
  BulkMoveDto,
  BulkCopyDto,
  BulkDownloadDto,
  BulkOperationResult,
  BulkDownloadResult,
} from './dto/bulk-operations.dto';

@ApiTags('documents')
@Controller('documents')
@UseGuards(JwtAuthGuard, OrganizationGuard)
@ApiBearerAuth()
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly processingService: ProcessingService,
    private readonly pdfService: PdfService,
  ) {}

  @Get()
  @AuditLog({
    action: AuditAction.DOCUMENT_READ,
    resourceType: AuditResourceType.DOCUMENT,
    includeQuery: true,
  })
  @ApiOperation({ summary: 'List documents' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'folderId', required: false, type: String })
  @ApiQuery({ name: 'q', required: false, type: String })
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('folderId') folderId?: string,
    @Query('q') search?: string,
  ) {
    return this.documentsService.findAll({
      organizationId: user.organizationId!,
      page,
      limit,
      folderId,
      search,
    });
  }

  @Post()
  @AuditDocument(AuditAction.DOCUMENT_CREATE, { includeBody: true })
  @ApiOperation({ summary: 'Create document and get upload URL' })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() createDocumentDto: CreateDocumentDto,
  ) {
    return this.documentsService.create({
      ...createDocumentDto,
      organizationId: user.organizationId!,
      createdById: user.id,
    });
  }

  @Get(':id')
  @AuditDocument(AuditAction.DOCUMENT_READ)
  @ApiOperation({ summary: 'Get document by ID' })
  @ApiParam({ name: 'id', type: String })
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.documentsService.findOne(id, user.organizationId!);
  }

  @Patch(':id')
  @AuditDocument(AuditAction.DOCUMENT_UPDATE, { includeBody: true })
  @ApiOperation({ summary: 'Update document' })
  @ApiParam({ name: 'id', type: String })
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() updateDocumentDto: UpdateDocumentDto,
  ) {
    return this.documentsService.update(id, user.organizationId!, updateDocumentDto);
  }

  @Delete(':id')
  @AuditDocument(AuditAction.DOCUMENT_DELETE)
  @ApiOperation({ summary: 'Delete document' })
  @ApiParam({ name: 'id', type: String })
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.documentsService.remove(id, user.organizationId!);
  }

  @Get(':id/download')
  @AuditDocument(AuditAction.DOCUMENT_DOWNLOAD)
  @ApiOperation({ summary: 'Get download URL' })
  @ApiParam({ name: 'id', type: String })
  async getDownloadUrl(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.documentsService.getDownloadUrl(id, user.organizationId!);
  }

  @Post(':id/confirm')
  @AuditDocument(AuditAction.DOCUMENT_UPDATE)
  @ApiOperation({ summary: 'Confirm document upload completed' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Upload confirmed successfully' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async confirmUpload(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.documentsService.confirmUpload(id, user.organizationId!);
  }

  @Post(':id/process')
  @AuditDocument(AuditAction.DOCUMENT_PROCESS, { includeBody: true })
  @ApiOperation({ summary: 'Trigger document processing' })
  @ApiParam({ name: 'id', type: String })
  async triggerProcessing(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() processDto: { type: string; options?: Record<string, unknown> },
  ) {
    return this.documentsService.triggerProcessing(id, user.organizationId!, processDto);
  }

  @Post(':id/move')
  @AuditDocument(AuditAction.DOCUMENT_MOVE, { includeBody: true })
  @ApiOperation({ summary: 'Move document to a different folder' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        folderId: { type: 'string', nullable: true, description: 'Target folder ID or null for root' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Document moved successfully' })
  @ApiResponse({ status: 404, description: 'Document or folder not found' })
  async moveDocument(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() moveDto: { folderId: string | null },
  ) {
    return this.documentsService.move(
      id,
      user.organizationId!,
      moveDto.folderId,
      { id: user.id, name: user.name || null, email: user.email },
    );
  }

  @Post(':id/copy')
  @AuditDocument(AuditAction.DOCUMENT_COPY, { includeBody: true })
  @ApiOperation({ summary: 'Copy document to a folder' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        folderId: { type: 'string', nullable: true, description: 'Target folder ID or null for root' },
        name: { type: 'string', description: 'Optional new name for the copy' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Document copied successfully' })
  @ApiResponse({ status: 404, description: 'Document or folder not found' })
  async copyDocument(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() copyDto: { folderId: string | null; name?: string },
  ) {
    return this.documentsService.copy(
      id,
      user.organizationId!,
      copyDto.folderId,
      copyDto.name,
      { id: user.id, name: user.name || null, email: user.email },
    );
  }

  // ==========================================
  // PDF Processing Endpoints
  // ==========================================

  @Get(':id/metadata')
  @ApiOperation({
    summary: 'Get PDF metadata',
    description: 'Extract metadata from a PDF document including page count, author, title, bookmarks, etc.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Document ID' })
  @ApiResponse({
    status: 200,
    description: 'PDF metadata extracted successfully',
    type: PdfMetadataDto,
  })
  @ApiResponse({ status: 400, description: 'Document is not a PDF' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async getMetadata(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const document = await this.documentsService.findOne(id, user.organizationId!);

    if (!document.mimeType.includes('pdf')) {
      throw new BadRequestException('Document is not a PDF');
    }

    // Queue a metadata extraction job
    const result = await this.processingService.addJob(id, 'PDF_METADATA' as any, {});

    return {
      jobId: result.job.id,
      status: 'PENDING',
      message: 'Metadata extraction job queued. Use the job status endpoint to check progress.',
    };
  }

  @Get(':id/metadata/sync')
  @ApiOperation({
    summary: 'Get PDF metadata synchronously',
    description: 'Extract metadata from a PDF document synchronously. Use for small files only.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Document ID' })
  @ApiResponse({
    status: 200,
    description: 'PDF metadata extracted successfully',
    type: PdfMetadataDto,
  })
  @ApiResponse({ status: 400, description: 'Document is not a PDF' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async getMetadataSync(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const document = await this.documentsService.findOne(id, user.organizationId!);

    if (!document.mimeType.includes('pdf')) {
      throw new BadRequestException('Document is not a PDF');
    }

    // Get buffer and extract metadata synchronously
    const buffer = await this.documentsService.getDocumentBuffer(id, user.organizationId!);
    const metadata = await this.pdfService.getMetadata(buffer);

    return { metadata };
  }

  @Post(':id/split')
  @ApiOperation({
    summary: 'Split a PDF document',
    description: 'Split a PDF by page ranges, bookmarks, or every N pages. Creates new documents for each split.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Document ID' })
  @ApiBody({ type: SplitDocumentRequestDto })
  @ApiResponse({
    status: 201,
    description: 'Split job queued successfully',
  })
  @ApiResponse({ status: 400, description: 'Document is not a PDF or invalid options' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async splitDocument(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() splitRequest: SplitDocumentRequestDto,
  ) {
    const document = await this.documentsService.findOne(id, user.organizationId!);

    if (!document.mimeType.includes('pdf')) {
      throw new BadRequestException('Document is not a PDF');
    }

    const result = await this.processingService.addJob(id, 'PDF_SPLIT', splitRequest.options as unknown as Record<string, unknown>);

    return {
      jobId: result.job.id,
      status: 'PENDING',
      message: 'PDF split job queued successfully',
      splitOptions: splitRequest.options,
    };
  }

  @Post('merge')
  @ApiOperation({
    summary: 'Merge multiple PDF documents',
    description: 'Merge multiple PDF documents into a single document. Documents are merged in the order provided.',
  })
  @ApiBody({ type: MergeDocumentsRequestDto })
  @ApiResponse({
    status: 201,
    description: 'Merge job queued successfully',
    type: MergeResultDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid document IDs or documents are not PDFs' })
  async mergeDocuments(
    @CurrentUser() user: CurrentUserPayload,
    @Body() mergeRequest: MergeDocumentsRequestDto,
  ) {
    const organizationId = user.organizationId!;
    const { documentIds, outputName, folderId } = mergeRequest.options;

    if (!documentIds || documentIds.length < 2) {
      throw new BadRequestException('At least 2 document IDs are required for merging');
    }

    // Validate all documents exist and are PDFs
    for (const docId of documentIds) {
      const doc = await this.documentsService.findOne(docId, organizationId);
      if (!doc.mimeType.includes('pdf')) {
        throw new BadRequestException(`Document ${docId} is not a PDF`);
      }
    }

    // Use the first document as the primary for the job
    const result = await this.processingService.addJob(documentIds[0], 'PDF_MERGE', {
      documentIds,
      outputName,
      folderId,
    });

    return {
      jobId: result.job.id,
      status: 'PENDING',
      message: 'PDF merge job queued successfully',
      documentsToMerge: documentIds.length,
      outputName,
    };
  }

  @Post(':id/watermark')
  @ApiOperation({
    summary: 'Add watermark to PDF',
    description: 'Add a text watermark to a PDF document. Creates a new watermarked document.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Document ID' })
  @ApiBody({ type: AddWatermarkRequestDto })
  @ApiResponse({
    status: 201,
    description: 'Watermark job queued successfully',
  })
  @ApiResponse({ status: 400, description: 'Document is not a PDF' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async addWatermark(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() watermarkRequest: AddWatermarkRequestDto,
  ) {
    const document = await this.documentsService.findOne(id, user.organizationId!);

    if (!document.mimeType.includes('pdf')) {
      throw new BadRequestException('Document is not a PDF');
    }

    const result = await this.processingService.addJob(id, 'PDF_WATERMARK' as any, watermarkRequest.options as unknown as Record<string, unknown>);

    return {
      jobId: result.job.id,
      status: 'PENDING',
      message: 'Watermark job queued successfully',
      watermarkText: watermarkRequest.options.text,
    };
  }

  @Post(':id/compress')
  @ApiOperation({
    summary: 'Compress PDF',
    description: 'Compress a PDF document to reduce file size. Creates a new compressed document.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Document ID' })
  @ApiBody({ type: CompressDocumentRequestDto })
  @ApiResponse({
    status: 201,
    description: 'Compression job queued successfully',
  })
  @ApiResponse({ status: 400, description: 'Document is not a PDF' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async compressDocument(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() compressRequest: CompressDocumentRequestDto,
  ) {
    const document = await this.documentsService.findOne(id, user.organizationId!);

    if (!document.mimeType.includes('pdf')) {
      throw new BadRequestException('Document is not a PDF');
    }

    const result = await this.processingService.addJob(id, 'PDF_COMPRESS' as any, compressRequest.options as unknown as Record<string, unknown>);

    return {
      jobId: result.job.id,
      status: 'PENDING',
      message: 'Compression job queued successfully',
      quality: compressRequest.options.quality,
    };
  }

  @Post(':id/extract-pages')
  @ApiOperation({
    summary: 'Extract pages from PDF',
    description: 'Extract specific pages from a PDF document. Creates a new document with only the extracted pages.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Document ID' })
  @ApiBody({ type: ExtractPagesRequestDto })
  @ApiResponse({
    status: 201,
    description: 'Page extraction job queued successfully',
  })
  @ApiResponse({ status: 400, description: 'Document is not a PDF' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async extractPages(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() extractRequest: ExtractPagesRequestDto,
  ) {
    const document = await this.documentsService.findOne(id, user.organizationId!);

    if (!document.mimeType.includes('pdf')) {
      throw new BadRequestException('Document is not a PDF');
    }

    const result = await this.processingService.addJob(id, 'PDF_EXTRACT_PAGES' as any, extractRequest.options as unknown as Record<string, unknown>);

    return {
      jobId: result.job.id,
      status: 'PENDING',
      message: 'Page extraction job queued successfully',
      pagesToExtract: extractRequest.options.pages,
    };
  }

  @Post(':id/render-page')
  @ApiOperation({
    summary: 'Render PDF page to image',
    description: 'Render a specific page of a PDF document to an image (PNG, JPEG, or WebP).',
  })
  @ApiParam({ name: 'id', type: String, description: 'Document ID' })
  @ApiBody({ type: RenderPageRequestDto })
  @ApiResponse({
    status: 201,
    description: 'Page render job queued successfully',
  })
  @ApiResponse({ status: 400, description: 'Document is not a PDF' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async renderPage(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() renderRequest: RenderPageRequestDto,
  ) {
    const document = await this.documentsService.findOne(id, user.organizationId!);

    if (!document.mimeType.includes('pdf')) {
      throw new BadRequestException('Document is not a PDF');
    }

    const result = await this.processingService.addJob(id, 'PDF_RENDER_PAGE' as any, {
      page: renderRequest.page,
      ...renderRequest.options,
    });

    return {
      jobId: result.job.id,
      status: 'PENDING',
      message: 'Page render job queued successfully',
      pageNumber: renderRequest.page,
    };
  }

  @Get(':id/thumbnail')
  @ApiOperation({
    summary: 'Get PDF thumbnail',
    description: 'Get or generate a thumbnail for the first page of the PDF.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Document ID' })
  @ApiQuery({ name: 'width', required: false, type: Number, description: 'Thumbnail width (default: 200)' })
  @ApiQuery({ name: 'format', required: false, enum: ['png', 'jpeg', 'webp'], description: 'Image format (default: png)' })
  @ApiResponse({
    status: 200,
    description: 'Thumbnail URL or generation job',
  })
  async getThumbnail(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Query('width') width = 200,
    @Query('format') format: 'png' | 'jpeg' | 'webp' = 'png',
  ) {
    const document = await this.documentsService.findOne(id, user.organizationId!);

    if (!document.mimeType.includes('pdf')) {
      throw new BadRequestException('Document is not a PDF');
    }

    // Check if thumbnail already exists in metadata
    const metadata = document.metadata as Record<string, unknown> | null;
    if (metadata?.thumbnailUrl) {
      return {
        thumbnailUrl: metadata.thumbnailUrl,
        cached: true,
      };
    }

    // Queue thumbnail generation
    const result = await this.processingService.addJob(id, 'PDF_RENDER_PAGE' as any, {
      page: 1,
      width,
      format,
    });

    return {
      jobId: result.job.id,
      status: 'PENDING',
      message: 'Thumbnail generation queued',
      cached: false,
    };
  }

  // ==========================================
  // Bulk Operations Endpoints
  // ==========================================

  @Post('bulk/delete')
  @AuditLog({
    action: AuditAction.DOCUMENT_DELETE,
    resourceType: AuditResourceType.DOCUMENT,
    includeBody: true,
  })
  @ApiOperation({
    summary: 'Bulk delete documents and folders',
    description: 'Delete multiple documents and folders at once. Supports soft delete (default) or permanent deletion.',
  })
  @ApiBody({ type: BulkDeleteDto })
  @ApiResponse({
    status: 200,
    description: 'Bulk delete completed',
    type: BulkOperationResult,
  })
  async bulkDelete(
    @CurrentUser() user: CurrentUserPayload,
    @Body() bulkDeleteDto: BulkDeleteDto,
  ): Promise<BulkOperationResult> {
    return this.documentsService.bulkDelete(
      user.organizationId!,
      bulkDeleteDto.documentIds,
      bulkDeleteDto.folderIds || [],
      bulkDeleteDto.permanent || false,
      { id: user.id, name: user.name || null, email: user.email },
    );
  }

  @Post('bulk/move')
  @AuditLog({
    action: AuditAction.DOCUMENT_MOVE,
    resourceType: AuditResourceType.DOCUMENT,
    includeBody: true,
  })
  @ApiOperation({
    summary: 'Bulk move documents and folders',
    description: 'Move multiple documents and folders to a target folder at once.',
  })
  @ApiBody({ type: BulkMoveDto })
  @ApiResponse({
    status: 200,
    description: 'Bulk move completed',
    type: BulkOperationResult,
  })
  async bulkMove(
    @CurrentUser() user: CurrentUserPayload,
    @Body() bulkMoveDto: BulkMoveDto,
  ): Promise<BulkOperationResult> {
    return this.documentsService.bulkMove(
      user.organizationId!,
      bulkMoveDto.documentIds,
      bulkMoveDto.folderIds || [],
      bulkMoveDto.targetFolderId,
      { id: user.id, name: user.name || null, email: user.email },
    );
  }

  @Post('bulk/copy')
  @AuditLog({
    action: AuditAction.DOCUMENT_COPY,
    resourceType: AuditResourceType.DOCUMENT,
    includeBody: true,
  })
  @ApiOperation({
    summary: 'Bulk copy documents',
    description: 'Copy multiple documents to a target folder at once.',
  })
  @ApiBody({ type: BulkCopyDto })
  @ApiResponse({
    status: 200,
    description: 'Bulk copy completed',
    type: BulkOperationResult,
  })
  async bulkCopy(
    @CurrentUser() user: CurrentUserPayload,
    @Body() bulkCopyDto: BulkCopyDto,
  ): Promise<BulkOperationResult> {
    return this.documentsService.bulkCopy(
      user.organizationId!,
      bulkCopyDto.documentIds,
      bulkCopyDto.targetFolderId,
      { id: user.id, name: user.name || null, email: user.email },
    );
  }

  @Post('bulk/download')
  @AuditLog({
    action: AuditAction.DOCUMENT_DOWNLOAD,
    resourceType: AuditResourceType.DOCUMENT,
    includeBody: true,
  })
  @ApiOperation({
    summary: 'Bulk download documents as ZIP',
    description: 'Download multiple documents and folders as a single ZIP file.',
  })
  @ApiBody({ type: BulkDownloadDto })
  @ApiResponse({
    status: 200,
    description: 'Bulk download ZIP created',
    type: BulkDownloadResult,
  })
  async bulkDownload(
    @CurrentUser() user: CurrentUserPayload,
    @Body() bulkDownloadDto: BulkDownloadDto,
  ): Promise<BulkDownloadResult> {
    return this.documentsService.createBulkDownload(
      user.organizationId!,
      bulkDownloadDto.documentIds,
      bulkDownloadDto.folderIds || [],
    );
  }
}
