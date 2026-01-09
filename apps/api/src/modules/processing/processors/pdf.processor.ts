import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';

import { PrismaService } from '@/common/prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { DOCUMENT_PROCESSING_QUEUE } from '../queues/queue.constants';
import { PdfService } from '../services/pdf.service';
import type { ProcessingJobData } from '../processing.service';
import {
  SplitType,
  type SplitOptionsDto,
  type MergeOptionsDto,
  type WatermarkOptionsDto,
  type CompressionOptionsDto,
  type PageRenderOptionsDto,
  type ExtractPagesOptionsDto,
} from '../dto';

/**
 * Job names handled by this processor
 */
type PdfJobName =
  | 'pdf_split'
  | 'pdf_merge'
  | 'pdf_watermark'
  | 'pdf_compress'
  | 'pdf_extract_pages'
  | 'pdf_render_page'
  | 'pdf_metadata';

/**
 * Extended job data for PDF operations
 */
interface PdfJobData extends Omit<ProcessingJobData, 'options'> {
  options?: SplitOptionsDto | MergeOptionsDto | WatermarkOptionsDto | CompressionOptionsDto | ExtractPagesOptionsDto | PageRenderOptionsDto | { page?: number };
}

/**
 * PDF Processor - BullMQ processor for all PDF operations
 * Handles: split, merge, watermark, compress, extract, render, metadata
 */
@Processor(DOCUMENT_PROCESSING_QUEUE)
export class PdfProcessor extends WorkerHost {
  private readonly logger = new Logger(PdfProcessor.name);

  private readonly PDF_JOB_NAMES: PdfJobName[] = [
    'pdf_split',
    'pdf_merge',
    'pdf_watermark',
    'pdf_compress',
    'pdf_extract_pages',
    'pdf_render_page',
    'pdf_metadata',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly pdfService: PdfService,
  ) {
    super();
  }

  /**
   * Main job processing method
   */
  async process(job: Job<PdfJobData>): Promise<Record<string, unknown>> {
    const jobName = job.name as PdfJobName;

    if (!this.PDF_JOB_NAMES.includes(jobName)) {
      throw new Error(`Processor cannot handle job type: ${jobName}`);
    }

    this.logger.log(`Processing ${jobName} job ${job.id}`);

    try {
      // Mark job as running
      await this.updateJobStatus(job.id as string, 'RUNNING');

      let result: Record<string, unknown>;

      switch (jobName) {
        case 'pdf_split':
          result = await this.handlePdfSplit(job);
          break;
        case 'pdf_merge':
          result = await this.handlePdfMerge(job);
          break;
        case 'pdf_watermark':
          result = await this.handlePdfWatermark(job);
          break;
        case 'pdf_compress':
          result = await this.handlePdfCompress(job);
          break;
        case 'pdf_extract_pages':
          result = await this.handlePdfExtractPages(job);
          break;
        case 'pdf_render_page':
          result = await this.handlePdfRenderPage(job);
          break;
        case 'pdf_metadata':
          result = await this.handlePdfMetadata(job);
          break;
        default:
          throw new Error(`Unknown job type: ${jobName}`);
      }

      // Mark job as completed
      await this.updateJobStatus(job.id as string, 'COMPLETED', result);
      await job.updateProgress(100);

      return result;
    } catch (error) {
      this.logger.error(`Job ${job.id} failed:`, error);

      await this.updateJobStatus(
        job.id as string,
        'FAILED',
        undefined,
        error instanceof Error ? error.message : 'Unknown error',
      );

      throw error;
    }
  }

  /**
   * Handle PDF split operation
   */
  private async handlePdfSplit(job: Job<PdfJobData>): Promise<Record<string, unknown>> {
    const { documentId, s3Key, organizationId, options } = job.data;
    const splitOptions = options as SplitOptionsDto;

    this.logger.log(`Splitting PDF document ${documentId}`);
    await job.updateProgress(5);

    // Fetch original document for createdById
    const sourceDocument = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { createdById: true },
    });

    if (!sourceDocument) {
      throw new Error(`Source document ${documentId} not found`);
    }

    // Fetch the PDF from S3
    const pdfBuffer = await this.fetchDocument(s3Key);
    await job.updateProgress(20);

    let splitResults;

    switch (splitOptions.type) {
      case SplitType.PAGES:
        if (!splitOptions.ranges || splitOptions.ranges.length === 0) {
          throw new Error('Page ranges are required for PAGES split type');
        }
        splitResults = await this.pdfService.splitByPages(pdfBuffer, splitOptions.ranges);
        break;

      case SplitType.BOOKMARKS:
        splitResults = await this.pdfService.splitByBookmarks(pdfBuffer);
        break;

      case SplitType.EVERY_N_PAGES:
        if (!splitOptions.everyNPages || splitOptions.everyNPages < 1) {
          throw new Error('everyNPages is required for EVERY_N_PAGES split type');
        }
        splitResults = await this.pdfService.splitEveryNPages(pdfBuffer, splitOptions.everyNPages);
        break;

      default:
        throw new Error(`Unknown split type: ${splitOptions.type}`);
    }

    await job.updateProgress(60);

    // Upload split documents to S3 and create document records
    const outputDocuments: Array<{
      s3Key: string;
      pageRange: string;
      pageCount: number;
      documentId: string;
      filename: string;
      sizeBytes: number;
    }> = [];

    const sourceTotalPages = await this.pdfService.getPageCount(pdfBuffer);
    const prefix = splitOptions.outputPrefix || 'split';

    for (let i = 0; i < splitResults.length; i++) {
      const split = splitResults[i];
      const filename = `${prefix}_${split.filename}`;
      const newS3Key = `${organizationId}/${uuidv4()}/${filename}`;

      // Upload to S3
      await this.storageService.uploadBuffer(newS3Key, split.buffer, 'application/pdf');

      // Create document record
      const newDocument = await this.prisma.document.create({
        data: {
          name: filename,
          mimeType: 'application/pdf',
          sizeBytes: split.buffer.length,
          s3Key: newS3Key,
          status: 'READY',
          processingStatus: 'COMPLETE',
          organization: { connect: { id: organizationId } },
          createdBy: { connect: { id: sourceDocument.createdById } },
          metadata: {
            sourceDocumentId: documentId,
            pageRange: split.pageRange,
            splitType: splitOptions.type,
          },
        } as any,
      });

      outputDocuments.push({
        s3Key: newS3Key,
        pageRange: split.pageRange,
        pageCount: split.pageCount,
        documentId: newDocument.id,
        filename,
        sizeBytes: split.buffer.length,
      });

      // Update progress
      const progressPercent = 60 + Math.round((i / splitResults.length) * 35);
      await job.updateProgress(progressPercent);
    }

    this.logger.log(`Split completed: ${outputDocuments.length} documents created`);

    return {
      outputDocuments,
      totalSplits: outputDocuments.length,
      sourceDocumentId: documentId,
      sourceTotalPages,
    };
  }

  /**
   * Handle PDF merge operation
   */
  private async handlePdfMerge(job: Job<PdfJobData>): Promise<Record<string, unknown>> {
    const { documentId, organizationId, options } = job.data;
    const mergeOptions = options as MergeOptionsDto;

    this.logger.log(`Merging ${mergeOptions.documentIds.length} PDF documents`);
    await job.updateProgress(5);

    // Fetch all source documents
    const sourceDocuments = await this.prisma.document.findMany({
      where: {
        id: { in: mergeOptions.documentIds },
        organizationId,
        mimeType: 'application/pdf',
      },
    });

    if (sourceDocuments.length !== mergeOptions.documentIds.length) {
      throw new Error('Some documents were not found or are not PDFs');
    }

    // Fetch all PDF buffers in order
    const pdfBuffers: Buffer[] = [];
    for (let i = 0; i < mergeOptions.documentIds.length; i++) {
      const doc = sourceDocuments.find((d) => d.id === mergeOptions.documentIds[i]);
      if (!doc) {
        throw new Error(`Document ${mergeOptions.documentIds[i]} not found`);
      }

      const buffer = await this.fetchDocument(doc.s3Key);
      pdfBuffers.push(buffer);

      const progressPercent = 5 + Math.round((i / mergeOptions.documentIds.length) * 40);
      await job.updateProgress(progressPercent);
    }

    await job.updateProgress(50);

    // Merge PDFs
    const mergeResult = await this.pdfService.merge(pdfBuffers);
    await job.updateProgress(80);

    // Upload merged document
    const filename = mergeOptions.outputName || 'merged.pdf';
    const newS3Key = `${organizationId}/${uuidv4()}/${filename}`;
    await this.storageService.uploadBuffer(newS3Key, mergeResult.buffer, 'application/pdf');

    await job.updateProgress(90);

    // Get the first source document for createdById
    const firstSourceDoc = sourceDocuments[0];

    // Create document record
    const newDocument = await this.prisma.document.create({
      data: {
        name: filename,
        mimeType: 'application/pdf',
        sizeBytes: mergeResult.buffer.length,
        s3Key: newS3Key,
        status: 'READY',
        processingStatus: 'COMPLETE',
        organization: { connect: { id: organizationId } },
        createdBy: { connect: { id: firstSourceDoc.createdById } },
        folder: mergeOptions.folderId ? { connect: { id: mergeOptions.folderId } } : undefined,
        metadata: {
          mergedFrom: mergeOptions.documentIds,
        },
      } as any,
    });

    this.logger.log(`Merge completed: ${filename} with ${mergeResult.pageCount} pages`);

    return {
      s3Key: newS3Key,
      documentId: newDocument.id,
      pageCount: mergeResult.pageCount,
      sizeBytes: mergeResult.buffer.length,
      sourceDocumentIds: mergeOptions.documentIds,
      filename,
    };
  }

  /**
   * Handle PDF watermark operation
   */
  private async handlePdfWatermark(job: Job<PdfJobData>): Promise<Record<string, unknown>> {
    const { documentId, s3Key, organizationId, options } = job.data;
    const watermarkOptions = options as WatermarkOptionsDto;

    this.logger.log(`Adding watermark to document ${documentId}`);
    await job.updateProgress(10);

    // Fetch the PDF
    const pdfBuffer = await this.fetchDocument(s3Key);
    await job.updateProgress(30);

    // Add watermark
    const result = await this.pdfService.addWatermark(pdfBuffer, watermarkOptions);
    await job.updateProgress(70);

    // Get original document info
    const originalDoc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    // Upload watermarked document
    const filename = `watermarked_${originalDoc?.name || 'document.pdf'}`;
    const newS3Key = `${organizationId}/${uuidv4()}/${filename}`;
    await this.storageService.uploadBuffer(newS3Key, result.buffer, 'application/pdf');

    await job.updateProgress(90);

    // Create new document record
    const newDocument = await this.prisma.document.create({
      data: {
        name: filename,
        mimeType: 'application/pdf',
        sizeBytes: result.buffer.length,
        s3Key: newS3Key,
        status: 'READY',
        processingStatus: 'COMPLETE',
        organization: { connect: { id: organizationId } },
        createdBy: { connect: { id: originalDoc!.createdById } },
        metadata: {
          sourceDocumentId: documentId,
          watermarkText: watermarkOptions.text,
        },
      } as any,
    });

    this.logger.log(`Watermark completed: ${result.pagesWatermarked} pages watermarked`);

    return {
      s3Key: newS3Key,
      documentId: newDocument.id,
      pagesWatermarked: result.pagesWatermarked,
      watermarkText: watermarkOptions.text,
      sizeBytes: result.buffer.length,
    };
  }

  /**
   * Handle PDF compress operation
   */
  private async handlePdfCompress(job: Job<PdfJobData>): Promise<Record<string, unknown>> {
    const { documentId, s3Key, organizationId, options } = job.data;
    const compressOptions = options as CompressionOptionsDto;

    this.logger.log(`Compressing document ${documentId}`);
    await job.updateProgress(10);

    // Fetch the PDF
    const pdfBuffer = await this.fetchDocument(s3Key);
    await job.updateProgress(30);

    // Compress
    const result = await this.pdfService.compress(pdfBuffer, compressOptions);
    await job.updateProgress(70);

    // Get original document info
    const originalDoc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    // Upload compressed document
    const filename = `compressed_${originalDoc?.name || 'document.pdf'}`;
    const newS3Key = `${organizationId}/${uuidv4()}/${filename}`;
    await this.storageService.uploadBuffer(newS3Key, result.buffer, 'application/pdf');

    await job.updateProgress(90);

    // Create new document record
    const newDocument = await this.prisma.document.create({
      data: {
        name: filename,
        mimeType: 'application/pdf',
        sizeBytes: result.compressedSize,
        s3Key: newS3Key,
        status: 'READY',
        processingStatus: 'COMPLETE',
        organization: { connect: { id: organizationId } },
        createdBy: { connect: { id: originalDoc!.createdById } },
        metadata: {
          sourceDocumentId: documentId,
          compressionQuality: compressOptions.quality,
          originalSize: result.originalSize,
        },
      } as any,
    });

    const compressionRatio = result.originalSize > 0
      ? 1 - result.compressedSize / result.originalSize
      : 0;

    this.logger.log(
      `Compression completed: ${result.originalSize} -> ${result.compressedSize} (${Math.round(compressionRatio * 100)}% saved)`,
    );

    return {
      s3Key: newS3Key,
      documentId: newDocument.id,
      originalSizeBytes: result.originalSize,
      compressedSizeBytes: result.compressedSize,
      compressionRatio,
      percentageSaved: Math.round(compressionRatio * 100),
    };
  }

  /**
   * Handle PDF extract pages operation
   */
  private async handlePdfExtractPages(job: Job<PdfJobData>): Promise<Record<string, unknown>> {
    const { documentId, s3Key, organizationId, options } = job.data;
    const extractOptions = options as ExtractPagesOptionsDto;

    this.logger.log(`Extracting pages from document ${documentId}`);
    await job.updateProgress(10);

    // Fetch original document for createdById
    const sourceDocument = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { createdById: true },
    });

    if (!sourceDocument) {
      throw new Error(`Source document ${documentId} not found`);
    }

    // Fetch the PDF
    const pdfBuffer = await this.fetchDocument(s3Key);
    await job.updateProgress(30);

    // Extract pages
    const extractedBuffer = await this.pdfService.extractPages(pdfBuffer, extractOptions.pages);
    await job.updateProgress(70);

    const pageCount = await this.pdfService.getPageCount(extractedBuffer);

    // Upload extracted document
    const filename = extractOptions.outputName || `extracted_pages_${extractOptions.pages.join('_')}.pdf`;
    const newS3Key = `${organizationId}/${uuidv4()}/${filename}`;
    await this.storageService.uploadBuffer(newS3Key, extractedBuffer, 'application/pdf');

    await job.updateProgress(90);

    // Create new document record
    const newDocument = await this.prisma.document.create({
      data: {
        name: filename,
        mimeType: 'application/pdf',
        sizeBytes: extractedBuffer.length,
        s3Key: newS3Key,
        status: 'READY',
        processingStatus: 'COMPLETE',
        organization: { connect: { id: organizationId } },
        createdBy: { connect: { id: sourceDocument.createdById } },
        metadata: {
          sourceDocumentId: documentId,
          extractedPages: extractOptions.pages,
        },
      } as any,
    });

    this.logger.log(`Extraction completed: ${pageCount} pages extracted`);

    return {
      s3Key: newS3Key,
      documentId: newDocument.id,
      extractedPages: extractOptions.pages,
      pageCount,
      sizeBytes: extractedBuffer.length,
      filename,
    };
  }

  /**
   * Handle PDF render page to image operation
   */
  private async handlePdfRenderPage(job: Job<PdfJobData>): Promise<Record<string, unknown>> {
    const { documentId, s3Key, organizationId, options } = job.data;
    const renderOptions = options as PageRenderOptionsDto & { page?: number };
    const pageNumber = renderOptions.page || 1;

    this.logger.log(`Rendering page ${pageNumber} of document ${documentId}`);
    await job.updateProgress(10);

    // Fetch the PDF
    const pdfBuffer = await this.fetchDocument(s3Key);
    await job.updateProgress(30);

    // Render page
    const result = await this.pdfService.renderPageToImage(pdfBuffer, pageNumber, renderOptions);
    await job.updateProgress(70);

    // Get original document info
    const originalDoc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    // Upload rendered image
    const baseName = originalDoc?.name?.replace(/\.pdf$/i, '') || 'document';
    const filename = `${baseName}_page_${pageNumber}.${result.format}`;
    const newS3Key = `${organizationId}/thumbnails/${uuidv4()}/${filename}`;

    const mimeType = result.format === 'jpeg' ? 'image/jpeg' : result.format === 'webp' ? 'image/webp' : 'image/png';
    await this.storageService.uploadBuffer(newS3Key, result.buffer, mimeType);

    await job.updateProgress(90);

    // Get download URL
    const downloadUrl = await this.storageService.getPresignedDownloadUrl(newS3Key);

    this.logger.log(`Page render completed: ${filename}`);

    return {
      s3Key: newS3Key,
      pageNumber,
      width: result.width,
      height: result.height,
      format: result.format,
      sizeBytes: result.buffer.length,
      downloadUrl,
    };
  }

  /**
   * Handle PDF metadata extraction
   */
  private async handlePdfMetadata(job: Job<PdfJobData>): Promise<Record<string, unknown>> {
    const { documentId, s3Key } = job.data;

    this.logger.log(`Extracting metadata from document ${documentId}`);
    await job.updateProgress(10);

    // Fetch the PDF
    const pdfBuffer = await this.fetchDocument(s3Key);
    await job.updateProgress(40);

    // Get metadata
    const metadata = await this.pdfService.getMetadata(pdfBuffer);
    await job.updateProgress(80);

    // Update document with metadata
    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        metadata: {
          pdf: metadata as unknown as Record<string, unknown>,
        } as any,
      },
    });

    this.logger.log(`Metadata extracted: ${metadata.pageCount} pages`);

    return { metadata };
  }

  /**
   * Fetch document from S3 and return as buffer
   */
  private async fetchDocument(s3Key: string): Promise<Buffer> {
    const fileStream = await this.storageService.getObject(s3Key);
    const chunks: Buffer[] = [];

    for await (const chunk of fileStream as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  /**
   * Update job status in database
   */
  private async updateJobStatus(
    jobId: string,
    status: 'RUNNING' | 'COMPLETED' | 'FAILED',
    outputData?: Record<string, unknown>,
    errorMessage?: string,
  ): Promise<void> {
    const updateData: Record<string, unknown> = { status };

    if (status === 'RUNNING') {
      updateData.startedAt = new Date();
    }

    if (status === 'COMPLETED' || status === 'FAILED') {
      updateData.completedAt = new Date();
    }

    if (outputData) {
      updateData.outputData = outputData;
    }

    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    await this.prisma.processingJob.update({
      where: { id: jobId },
      data: updateData,
    });
  }

  /**
   * Event handler for failed jobs
   */
  @OnWorkerEvent('failed')
  onFailed(job: Job<PdfJobData>, error: Error): void {
    this.logger.error(`PDF job ${job.id} failed: ${error.message}`);
  }

  /**
   * Event handler for completed jobs
   */
  @OnWorkerEvent('completed')
  onCompleted(job: Job<PdfJobData>): void {
    this.logger.log(`PDF job ${job.id} completed successfully`);
  }

  /**
   * Event handler for active jobs
   */
  @OnWorkerEvent('active')
  onActive(job: Job<PdfJobData>): void {
    this.logger.debug(`PDF job ${job.id} is now active`);
  }
}
