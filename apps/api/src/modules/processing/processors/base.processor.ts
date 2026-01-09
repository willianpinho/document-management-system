/**
 * Base Processor
 *
 * Abstract base class for all job processors providing common functionality:
 * - Error handling with proper error categorization
 * - Progress reporting
 * - Logging with structured context
 * - Job retry logic
 * - Database status updates
 */

import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError, DelayedError } from 'bullmq';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ProcessingJobStatus } from '../queues/queue.constants';

/**
 * Error categories for job processing
 */
export enum ErrorCategory {
  /** Transient errors that should be retried */
  TRANSIENT = 'TRANSIENT',
  /** Permanent errors that should not be retried */
  PERMANENT = 'PERMANENT',
  /** Rate limit errors that should be retried after delay */
  RATE_LIMITED = 'RATE_LIMITED',
  /** Unknown errors (will be retried) */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Categorized error with retry information
 */
export interface CategorizedError {
  category: ErrorCategory;
  message: string;
  originalError: Error;
  retryAfterMs?: number;
}

/**
 * Progress update payload
 */
export interface ProgressUpdate {
  percentage: number;
  stage?: string;
  details?: Record<string, unknown>;
}

/**
 * Base job data interface
 */
export interface BaseJobData {
  documentId: string;
  organizationId: string;
  s3Key: string;
}

/**
 * Abstract base processor class
 */
export abstract class BaseProcessor<
  TData extends BaseJobData,
  TResult = unknown,
> {
  protected abstract readonly logger: Logger;

  constructor(protected readonly prisma: PrismaService) {}

  /**
   * Main processing method - to be implemented by subclasses
   */
  protected abstract executeJob(job: Job<TData>): Promise<TResult>;

  /**
   * Process a job with full error handling and status management
   */
  async processJob(job: Job<TData>): Promise<TResult> {
    const startTime = Date.now();
    const { documentId } = job.data;

    this.logger.log(
      `Starting job ${job.id} for document ${documentId}`,
      this.getLogContext(job),
    );

    try {
      // Update status to running
      await this.updateJobStatus(job.id as string, 'RUNNING');
      await this.updateDocumentStatus(documentId, 'PROCESSING');

      // Execute the actual job
      const result = await this.executeJob(job);

      // Update status to completed
      const duration = Date.now() - startTime;
      await this.updateJobStatus(job.id as string, 'COMPLETED', {
        result,
        durationMs: duration,
      });

      this.logger.log(
        `Job ${job.id} completed in ${duration}ms`,
        this.getLogContext(job),
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const categorizedError = this.categorizeError(error as Error);

      this.logger.error(
        `Job ${job.id} failed after ${duration}ms: ${categorizedError.message}`,
        (error as Error).stack,
        this.getLogContext(job),
      );

      // Update job status
      await this.updateJobStatus(job.id as string, 'FAILED', undefined, {
        message: categorizedError.message,
        category: categorizedError.category,
        stack: (error as Error).stack,
      });

      // Handle based on error category
      switch (categorizedError.category) {
        case ErrorCategory.PERMANENT:
          // Don't retry permanent errors
          await this.updateDocumentStatus(documentId, 'FAILED');
          throw new UnrecoverableError(categorizedError.message);

        case ErrorCategory.RATE_LIMITED:
          // Retry after delay
          throw new DelayedError(
            String(categorizedError.retryAfterMs || 60000),
          );

        case ErrorCategory.TRANSIENT:
        case ErrorCategory.UNKNOWN:
        default:
          // Let BullMQ handle retry
          throw error;
      }
    }
  }

  /**
   * Update job progress with optional stage and details
   */
  protected async updateProgress(
    job: Job<TData>,
    update: ProgressUpdate,
  ): Promise<void> {
    await job.updateProgress(update.percentage);

    if (update.stage || update.details) {
      this.logger.debug(
        `Job ${job.id} progress: ${update.percentage}% - ${update.stage || ''}`,
        this.getLogContext(job),
      );
    }
  }

  /**
   * Update job status in the database
   */
  protected async updateJobStatus(
    jobId: string,
    status: ProcessingJobStatus,
    outputData?: Record<string, unknown>,
    errorData?: Record<string, unknown>,
  ): Promise<void> {
    try {
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

      if (errorData) {
        updateData.errorMessage = errorData.message;
        updateData.errorStack = errorData.stack;
      }

      await this.prisma.processingJob.update({
        where: { id: jobId },
        data: updateData,
      });
    } catch (error) {
      // Log but don't fail the job due to status update failure
      this.logger.warn(
        `Failed to update job status for ${jobId}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Update document processing status
   */
  protected async updateDocumentStatus(
    documentId: string,
    status: string,
  ): Promise<void> {
    try {
      await this.prisma.document.update({
        where: { id: documentId },
        data: { processingStatus: status as any },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to update document status for ${documentId}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Categorize an error for proper handling
   */
  protected categorizeError(error: Error): CategorizedError {
    const message = error.message || 'Unknown error';
    const lowerMessage = message.toLowerCase();

    // AWS errors
    if (lowerMessage.includes('rate exceeded') || lowerMessage.includes('throttl')) {
      return {
        category: ErrorCategory.RATE_LIMITED,
        message,
        originalError: error,
        retryAfterMs: 60000, // 1 minute
      };
    }

    if (lowerMessage.includes('access denied') || lowerMessage.includes('forbidden')) {
      return {
        category: ErrorCategory.PERMANENT,
        message: 'Access denied - check permissions',
        originalError: error,
      };
    }

    if (lowerMessage.includes('not found') || lowerMessage.includes('does not exist')) {
      return {
        category: ErrorCategory.PERMANENT,
        message: 'Resource not found',
        originalError: error,
      };
    }

    // OpenAI errors
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('429')) {
      return {
        category: ErrorCategory.RATE_LIMITED,
        message,
        originalError: error,
        retryAfterMs: this.extractRetryAfter(error) || 60000,
      };
    }

    if (lowerMessage.includes('invalid api key') || lowerMessage.includes('authentication')) {
      return {
        category: ErrorCategory.PERMANENT,
        message: 'Invalid API credentials',
        originalError: error,
      };
    }

    // Network/transient errors
    if (
      lowerMessage.includes('timeout') ||
      lowerMessage.includes('econnrefused') ||
      lowerMessage.includes('econnreset') ||
      lowerMessage.includes('network')
    ) {
      return {
        category: ErrorCategory.TRANSIENT,
        message,
        originalError: error,
      };
    }

    // Invalid input (permanent)
    if (
      lowerMessage.includes('invalid') ||
      lowerMessage.includes('unsupported') ||
      lowerMessage.includes('corrupt')
    ) {
      return {
        category: ErrorCategory.PERMANENT,
        message,
        originalError: error,
      };
    }

    // Default to unknown (will retry)
    return {
      category: ErrorCategory.UNKNOWN,
      message,
      originalError: error,
    };
  }

  /**
   * Extract retry-after value from error if present
   */
  protected extractRetryAfter(error: Error): number | undefined {
    // Check for retry-after in error properties
    const anyError = error as unknown as Record<string, unknown>;
    if (typeof anyError.retryAfter === 'number') {
      return anyError.retryAfter * 1000;
    }

    // Try to parse from message
    const match = error.message.match(/retry after (\d+)/i);
    if (match) {
      return parseInt(match[1], 10) * 1000;
    }

    return undefined;
  }

  /**
   * Get logging context for a job
   */
  protected getLogContext(job: Job<TData>): Record<string, unknown> {
    return {
      jobId: job.id,
      jobName: job.name,
      documentId: job.data.documentId,
      organizationId: job.data.organizationId,
      attempt: job.attemptsMade,
    };
  }

  /**
   * Check if document exists before processing
   */
  protected async validateDocument(documentId: string): Promise<boolean> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true },
    });
    return !!document;
  }

  /**
   * Stream file from S3 to buffer
   */
  protected async streamToBuffer(
    stream: AsyncIterable<Uint8Array>,
  ): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
