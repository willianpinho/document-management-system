import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '@/common/prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { TextractService } from '../services/textract.service';
import { EmbeddingService } from '../services/embedding.service';
import { DOCUMENT_PROCESSING_QUEUE } from '../queues/queue.constants';
import type { ProcessingJobData } from '../processing.service';
import {
  OcrResult,
  OcrProcessingOptions,
  isSupportedOcrMimeType,
} from '../dto/ocr-result.dto';

/**
 * OCR processing result
 */
interface OcrProcessorResult {
  extractedText: string;
  textLength: number;
  pageCount: number;
  tableCount: number;
  formFieldCount: number;
  confidence: number;
  processingTimeMs: number;
  usedAsyncProcessing: boolean;
  embeddingGenerated: boolean;
}

/**
 * OCR Processor
 *
 * Handles document text extraction using AWS Textract.
 * Supports both synchronous processing for single-page documents
 * and asynchronous processing for multi-page PDFs.
 *
 * Features:
 * - Text extraction with reading order preservation
 * - Table detection and extraction
 * - Form field (key-value) extraction
 * - Signature detection
 * - Multi-page PDF support (async)
 * - Automatic embedding generation (optional)
 * - Retry handling with exponential backoff
 */
@Processor(DOCUMENT_PROCESSING_QUEUE)
export class OcrProcessor extends WorkerHost {
  private readonly logger = new Logger(OcrProcessor.name);
  private readonly maxRetries: number;
  private readonly pollIntervalMs: number;
  private readonly maxWaitMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
    private readonly textractService: TextractService,
    private readonly embeddingService: EmbeddingService,
  ) {
    super();

    this.maxRetries = this.configService.get<number>('OCR_MAX_RETRIES', 3);
    this.pollIntervalMs = this.configService.get<number>('TEXTRACT_POLL_INTERVAL_MS', 5000);
    this.maxWaitMs = this.configService.get<number>('TEXTRACT_MAX_WAIT_MS', 300000);
  }

  /**
   * Process OCR job
   */
  async process(job: Job<ProcessingJobData>): Promise<OcrProcessorResult> {
    // Only handle OCR jobs
    if (job.name !== 'ocr') {
      throw new Error(`OcrProcessor cannot handle job type: ${job.name}`);
    }

    const { documentId, s3Key, organizationId, options } = job.data;
    const startTime = Date.now();

    this.logger.log(`Starting OCR for document ${documentId} (${s3Key})`);

    try {
      // Update job status to running
      await this.updateJobStatus(job, 'RUNNING');
      await this.updateDocumentStatus(documentId, 'OCR_IN_PROGRESS');
      await job.updateProgress(5);

      // Get document metadata to determine processing mode
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          mimeType: true,
          sizeBytes: true,
          name: true,
          metadata: true,
        },
      });

      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }

      // Validate document type
      if (!isSupportedOcrMimeType(document.mimeType)) {
        throw new Error(
          `Unsupported file type for OCR: ${document.mimeType}. ` +
            `Supported types: PDF, JPEG, PNG, TIFF`,
        );
      }

      // Validate file size
      this.textractService.validateDocument(
        document.mimeType,
        Number(document.sizeBytes),
      );

      await job.updateProgress(10);

      // Determine processing options
      const ocrOptions = this.parseOptions(options);

      // Determine if async processing is needed
      const useAsync = this.textractService.shouldUseAsyncProcessing(
        document.mimeType,
        Number(document.sizeBytes),
        ocrOptions,
      );

      let ocrResult: OcrResult;

      if (useAsync) {
        ocrResult = await this.processAsync(job, s3Key, ocrOptions);
      } else {
        ocrResult = await this.processSync(job, s3Key, ocrOptions);
      }

      await job.updateProgress(80);

      // Update document with OCR results
      await this.saveOcrResults(documentId, ocrResult);

      await job.updateProgress(85);

      // Generate embeddings if requested or enabled by default
      let embeddingGenerated = false;
      if (
        ocrOptions.generateEmbeddings !== false &&
        ocrResult.text.length > 0 &&
        this.embeddingService.isAvailable()
      ) {
        try {
          await this.embeddingService.generateAndStoreEmbedding(
            documentId,
            ocrResult.text,
          );
          embeddingGenerated = true;
          this.logger.log(`Generated embedding for document ${documentId}`);
        } catch (embeddingError) {
          // Log but don't fail the job for embedding errors
          this.logger.warn(
            `Failed to generate embedding for document ${documentId}: ${embeddingError}`,
          );
        }
      }

      await job.updateProgress(95);

      // Update job completion
      const processingTimeMs = Date.now() - startTime;
      await this.completeJob(job, ocrResult, processingTimeMs, embeddingGenerated);

      await job.updateProgress(100);

      const result: OcrProcessorResult = {
        extractedText: ocrResult.text,
        textLength: ocrResult.characterCount,
        pageCount: ocrResult.pageCount,
        tableCount: ocrResult.tables.length,
        formFieldCount: ocrResult.formFields.length,
        confidence: ocrResult.confidence,
        processingTimeMs,
        usedAsyncProcessing: useAsync,
        embeddingGenerated,
      };

      this.logger.log(
        `OCR completed for document ${documentId} in ${processingTimeMs}ms ` +
          `(${ocrResult.wordCount} words, ${ocrResult.tables.length} tables, ` +
          `${ocrResult.formFields.length} form fields)`,
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `OCR failed for document ${documentId}: ${errorMessage}`,
        errorStack,
      );

      await this.failJob(job, documentId, errorMessage, errorStack);

      throw error;
    }
  }

  /**
   * Process document synchronously (for single-page images and small PDFs)
   */
  private async processSync(
    job: Job<ProcessingJobData>,
    s3Key: string,
    options: OcrProcessingOptions,
  ): Promise<OcrResult> {
    this.logger.debug(`Using synchronous processing for ${s3Key}`);

    await job.updateProgress(20);

    const result = await this.textractService.analyzeDocument(
      s3Key,
      options.features,
    );

    await job.updateProgress(70);

    return result;
  }

  /**
   * Process document asynchronously (for multi-page PDFs and large files)
   */
  private async processAsync(
    job: Job<ProcessingJobData>,
    s3Key: string,
    options: OcrProcessingOptions,
  ): Promise<OcrResult> {
    this.logger.debug(`Using asynchronous processing for ${s3Key}`);

    await job.updateProgress(15);

    // Start async job
    const textractJobId = await this.textractService.startDocumentAnalysis(
      s3Key,
      options,
    );

    this.logger.log(`Started Textract job ${textractJobId} for ${s3Key}`);

    await job.updateProgress(20);

    // Store job ID in processing job metadata
    await this.prisma.processingJob.update({
      where: { id: job.id as string },
      data: {
        inputParams: {
          ...(job.data.options || {}),
          textractJobId,
        },
      },
    });

    // Poll for completion
    const result = await this.pollForCompletion(job, textractJobId);

    return result;
  }

  /**
   * Poll for async job completion
   */
  private async pollForCompletion(
    job: Job<ProcessingJobData>,
    textractJobId: string,
  ): Promise<OcrResult> {
    const startTime = Date.now();
    let pollCount = 0;
    let waitTime = this.pollIntervalMs;

    while (Date.now() - startTime < this.maxWaitMs) {
      pollCount++;

      // Update progress based on poll count (20-70%)
      const progress = Math.min(20 + pollCount * 5, 70);
      await job.updateProgress(progress);

      // Check for job completion
      const result = await this.textractService.getDocumentAnalysis(textractJobId);

      if (result !== null) {
        this.logger.log(
          `Textract job ${textractJobId} completed after ${pollCount} polls`,
        );
        return result;
      }

      // Wait with exponential backoff (max 30 seconds)
      await this.sleep(waitTime);
      waitTime = Math.min(waitTime * 1.5, 30000);

      this.logger.debug(
        `Poll ${pollCount}: Textract job ${textractJobId} still in progress`,
      );
    }

    throw new Error(
      `Textract job ${textractJobId} did not complete within ${this.maxWaitMs}ms`,
    );
  }

  /**
   * Save OCR results to document
   */
  private async saveOcrResults(
    documentId: string,
    ocrResult: OcrResult,
  ): Promise<void> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { metadata: true },
    });

    const existingMetadata = (document?.metadata as Record<string, unknown>) || {};

    // Prepare OCR metadata (exclude large data)
    const ocrMetadata = {
      ocrProcessedAt: new Date().toISOString(),
      ocrVersion: '1.0',
      pageCount: ocrResult.pageCount,
      wordCount: ocrResult.wordCount,
      characterCount: ocrResult.characterCount,
      confidence: ocrResult.confidence,
      tableCount: ocrResult.tables.length,
      formFieldCount: ocrResult.formFields.length,
      signatureCount: ocrResult.signatures.length,
      processingTimeMs: ocrResult.metadata.processingTimeMs,
      featureTypes: ocrResult.metadata.featureTypes,
      textractJobId: ocrResult.textractJobId,
      // Store tables and form fields in metadata for structured access
      tables: ocrResult.tables.map((table) => ({
        id: table.id,
        page: table.page,
        rowCount: table.rowCount,
        columnCount: table.columnCount,
        rows: table.rows,
        confidence: table.confidence,
      })),
      formFields: ocrResult.formFields.map((field) => ({
        key: field.key,
        value: field.value,
        page: field.page,
        keyConfidence: field.keyConfidence,
        valueConfidence: field.valueConfidence,
      })),
    };

    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        extractedText: ocrResult.text,
        processingStatus: 'OCR_COMPLETE',
        metadata: {
          ...existingMetadata,
          ocr: ocrMetadata,
        } as any,
      },
    });

    this.logger.debug(`Saved OCR results for document ${documentId}`);
  }

  /**
   * Parse job options into OcrProcessingOptions
   */
  private parseOptions(options?: Record<string, unknown>): OcrProcessingOptions {
    const defaults: OcrProcessingOptions = {
      features: ['TABLES', 'FORMS'],
      forceAsync: false,
      generateEmbeddings: true,
      runClassification: false,
    };

    if (!options) return defaults;

    return {
      features: (options.features as OcrProcessingOptions['features']) || defaults.features,
      forceAsync: (options.forceAsync as boolean) ?? defaults.forceAsync,
      notificationTopicArn: options.notificationTopicArn as string,
      outputPrefix: options.outputPrefix as string,
      maxPages: options.maxPages as number,
      generateEmbeddings: (options.generateEmbeddings as boolean) ?? defaults.generateEmbeddings,
      runClassification: (options.runClassification as boolean) ?? defaults.runClassification,
    };
  }

  /**
   * Update job status in database
   */
  private async updateJobStatus(
    job: Job<ProcessingJobData>,
    status: 'RUNNING' | 'COMPLETED' | 'FAILED',
  ): Promise<void> {
    const updateData: Record<string, unknown> = {
      status,
    };

    if (status === 'RUNNING') {
      updateData.startedAt = new Date();
    }

    await this.prisma.processingJob.update({
      where: { id: job.id as string },
      data: updateData,
    });
  }

  /**
   * Update document processing status
   */
  private async updateDocumentStatus(
    documentId: string,
    status: string,
  ): Promise<void> {
    await this.prisma.document.update({
      where: { id: documentId },
      data: { processingStatus: status as 'PENDING' | 'OCR_IN_PROGRESS' | 'OCR_COMPLETE' | 'EMBEDDING_IN_PROGRESS' | 'COMPLETE' | 'FAILED' },
    });
  }

  /**
   * Complete the job successfully
   */
  private async completeJob(
    job: Job<ProcessingJobData>,
    ocrResult: OcrResult,
    processingTimeMs: number,
    embeddingGenerated: boolean,
  ): Promise<void> {
    await this.prisma.processingJob.update({
      where: { id: job.id as string },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        outputData: {
          textLength: ocrResult.characterCount,
          wordCount: ocrResult.wordCount,
          pageCount: ocrResult.pageCount,
          tableCount: ocrResult.tables.length,
          formFieldCount: ocrResult.formFields.length,
          signatureCount: ocrResult.signatures.length,
          confidence: ocrResult.confidence,
          processingTimeMs,
          embeddingGenerated,
          textractJobId: ocrResult.textractJobId,
        },
      },
    });

    // Update document status
    await this.prisma.document.update({
      where: { id: job.data.documentId },
      data: {
        processingStatus: embeddingGenerated ? 'COMPLETE' : 'OCR_COMPLETE',
        status: 'READY',
      },
    });
  }

  /**
   * Mark job as failed
   */
  private async failJob(
    job: Job<ProcessingJobData>,
    documentId: string,
    errorMessage: string,
    errorStack?: string,
  ): Promise<void> {
    await this.prisma.processingJob.update({
      where: { id: job.id as string },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage,
        errorStack,
        attempts: {
          increment: 1,
        },
      },
    });

    await this.prisma.document.update({
      where: { id: documentId },
      data: { processingStatus: 'FAILED' },
    });
  }

  /**
   * Helper: Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Event: Job failed
   */
  @OnWorkerEvent('failed')
  onFailed(job: Job<ProcessingJobData>, error: Error): void {
    this.logger.error(
      `OCR job ${job.id} failed: ${error.message}`,
      error.stack,
    );
  }

  /**
   * Event: Job completed
   */
  @OnWorkerEvent('completed')
  onCompleted(job: Job<ProcessingJobData>, result: OcrProcessorResult): void {
    this.logger.log(
      `OCR job ${job.id} completed: ${result.textLength} chars extracted in ${result.processingTimeMs}ms`,
    );
  }

  /**
   * Event: Job active (started processing)
   */
  @OnWorkerEvent('active')
  onActive(job: Job<ProcessingJobData>): void {
    this.logger.log(`OCR job ${job.id} started for document ${job.data.documentId}`);
  }

  /**
   * Event: Job stalled
   */
  @OnWorkerEvent('stalled')
  onStalled(jobId: string): void {
    this.logger.warn(`OCR job ${jobId} stalled`);
  }
}
