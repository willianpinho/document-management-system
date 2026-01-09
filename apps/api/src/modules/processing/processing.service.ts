/**
 * Processing Service
 *
 * Main service for managing document processing jobs across multiple queues.
 * Provides a unified interface for:
 * - Adding jobs to appropriate queues
 * - Querying job status
 * - Retrying failed jobs
 * - Canceling pending jobs
 * - Queue statistics and management
 * - Cleanup of old jobs
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job, JobType } from 'bullmq';

import { PrismaService } from '@/common/prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ProcessingJobEventData } from '../realtime/dto/realtime-events.dto';
import {
  DOCUMENT_PROCESSING_QUEUE,
  QUEUE_NAMES,
  QueueName,
  ProcessingJobType,
  ProcessingJobStatus,
  JOB_TYPE_PRIORITIES,
} from './queues/queue.constants';
import { AggregatedQueueStats, QueueStats } from './queues/queue.types';

/**
 * Job data passed to queue processors
 */
export interface ProcessingJobData {
  documentId: string;
  s3Key: string;
  organizationId: string;
  options?: Record<string, unknown>;
}

/**
 * Options for adding a job
 */
export interface AddJobOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  removeOnComplete?: boolean;
  removeOnFail?: boolean;
}

/**
 * Job status response
 */
export interface JobStatusResponse {
  id: string;
  documentId: string;
  jobType: string;
  status: string;
  queueState: string | null;
  progress: number | object;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
  outputData: unknown;
  document: {
    id: string;
    name: string;
    status: string;
    processingStatus: string;
  } | null;
}

@Injectable()
export class ProcessingService {
  private readonly logger = new Logger(ProcessingService.name);
  private readonly queues: Map<string, Queue>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
    @InjectQueue(DOCUMENT_PROCESSING_QUEUE) private readonly legacyQueue: Queue,
    @InjectQueue(QUEUE_NAMES.OCR) private readonly ocrQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PDF) private readonly pdfQueue: Queue,
    @InjectQueue(QUEUE_NAMES.THUMBNAIL) private readonly thumbnailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EMBEDDING) private readonly embeddingQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AI_CLASSIFY) private readonly aiClassifyQueue: Queue,
  ) {
    // Build queue map for easy lookup
    this.queues = new Map([
      [DOCUMENT_PROCESSING_QUEUE, this.legacyQueue],
      [QUEUE_NAMES.OCR, this.ocrQueue],
      [QUEUE_NAMES.PDF, this.pdfQueue],
      [QUEUE_NAMES.THUMBNAIL, this.thumbnailQueue],
      [QUEUE_NAMES.EMBEDDING, this.embeddingQueue],
      [QUEUE_NAMES.AI_CLASSIFY, this.aiClassifyQueue],
    ]);
  }

  /**
   * Convert a Prisma processing job to event data format
   */
  private toEventData(job: {
    id: string;
    documentId: string;
    jobType: string;
    status: string;
    attempts: number;
    maxAttempts: number;
    createdAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
    errorMessage: string | null;
  }, progress: number = 0): ProcessingJobEventData {
    return {
      id: job.id,
      documentId: job.documentId,
      jobType: job.jobType,
      status: job.status,
      progress,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString() || null,
      completedAt: job.completedAt?.toISOString() || null,
      errorMessage: job.errorMessage,
    };
  }

  /**
   * Emit a processing started event
   */
  emitProcessingStarted(
    job: ProcessingJobEventData,
    document: { id: string; name: string },
    organizationId: string,
  ): void {
    this.realtimeService.emitProcessingStarted(job, document, organizationId);
  }

  /**
   * Emit a processing progress event
   */
  emitProcessingProgress(
    jobId: string,
    documentId: string,
    organizationId: string,
    progress: number,
    message?: string,
    stage?: string,
  ): void {
    this.realtimeService.emitProcessingProgress(
      jobId,
      documentId,
      organizationId,
      progress,
      message,
      stage,
    );
  }

  /**
   * Emit a processing completed event
   */
  emitProcessingCompleted(
    job: ProcessingJobEventData,
    document: { id: string; name: string; processingStatus: string },
    organizationId: string,
    result?: { type: string; data: unknown },
  ): void {
    this.realtimeService.emitProcessingCompleted(job, document, organizationId, result);
  }

  /**
   * Emit a processing failed event
   */
  emitProcessingFailed(
    job: ProcessingJobEventData,
    document: { id: string; name: string },
    organizationId: string,
    error: { message: string; code?: string; retryable: boolean },
  ): void {
    this.realtimeService.emitProcessingFailed(job, document, organizationId, error);
  }

  /**
   * Add a processing job to the appropriate queue
   */
  async addJob(
    documentId: string,
    jobType: ProcessingJobType,
    options?: Record<string, unknown>,
    jobOptions?: AddJobOptions,
  ): Promise<{
    job: { id: string };
    queueJobId: string;
    queueName: string;
    message: string;
  }> {
    // Get document details
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        name: true,
        s3Key: true,
        organizationId: true,
        mimeType: true,
        sizeBytes: true,
      },
    });

    if (!document) {
      throw new NotFoundException(`Document not found: ${documentId}`);
    }

    // Create database record for tracking
    const processingJob = await this.prisma.processingJob.create({
      data: {
        documentId,
        jobType,
        status: 'PENDING',
        inputParams: (options || {}) as any,
        maxAttempts: jobOptions?.attempts || 3,
      },
    });

    // Update document status
    await this.prisma.document.update({
      where: { id: documentId },
      data: { processingStatus: 'PENDING' },
    });

    // Determine target queue based on job type
    const queue = this.getQueueForJobType(jobType);
    const queueName = this.getQueueNameForJobType(jobType);

    // Build job data
    const jobData: ProcessingJobData = {
      documentId,
      s3Key: document.s3Key,
      organizationId: document.organizationId,
      options,
    };

    // Add to queue
    const queueJob = await queue.add(
      this.getJobNameForType(jobType),
      jobData,
      {
        jobId: processingJob.id,
        priority: jobOptions?.priority ?? JOB_TYPE_PRIORITIES[jobType],
        delay: jobOptions?.delay,
        attempts: jobOptions?.attempts,
        removeOnComplete: jobOptions?.removeOnComplete,
        removeOnFail: jobOptions?.removeOnFail,
      },
    );

    this.logger.log(
      `Job ${processingJob.id} (${jobType}) added to ${queueName} for document ${documentId}`,
    );

    // Emit real-time event for job started
    this.emitProcessingStarted(
      this.toEventData(processingJob),
      { id: document.id, name: document.name },
      document.organizationId,
    );

    return {
      job: { id: processingJob.id },
      queueJobId: queueJob.id as string,
      queueName,
      message: 'Processing job created',
    };
  }

  /**
   * Get job status by ID
   */
  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    const processingJob = await this.prisma.processingJob.findUnique({
      where: { id: jobId },
      include: {
        document: {
          select: {
            id: true,
            name: true,
            status: true,
            processingStatus: true,
          },
        },
      },
    });

    if (!processingJob) {
      throw new NotFoundException(`Processing job not found: ${jobId}`);
    }

    // Try to find the job in the appropriate queue
    const queue = this.getQueueForJobType(processingJob.jobType as ProcessingJobType);
    let queueJob: Job | undefined;
    let queueState: string | null = null;

    try {
      queueJob = await queue.getJob(jobId);
      if (queueJob) {
        queueState = await queueJob.getState();
      }
    } catch {
      // Job might not exist in queue anymore
    }

    // Also check legacy queue
    if (!queueJob) {
      try {
        queueJob = await this.legacyQueue.getJob(jobId);
        if (queueJob) {
          queueState = await queueJob.getState();
        }
      } catch {
        // Ignore
      }
    }

    return {
      id: processingJob.id,
      documentId: processingJob.documentId,
      jobType: processingJob.jobType,
      status: processingJob.status,
      queueState,
      progress: (queueJob?.progress ?? 0) as number | object,
      attempts: processingJob.attempts,
      maxAttempts: processingJob.maxAttempts,
      createdAt: processingJob.createdAt,
      startedAt: processingJob.startedAt,
      completedAt: processingJob.completedAt,
      errorMessage: processingJob.errorMessage,
      outputData: processingJob.outputData,
      document: processingJob.document,
    };
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<{ success: boolean; message: string }> {
    const job = await this.prisma.processingJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`Job not found: ${jobId}`);
    }

    if (job.status !== 'FAILED') {
      throw new BadRequestException('Can only retry failed jobs');
    }

    if (job.attempts >= job.maxAttempts) {
      throw new BadRequestException(
        `Maximum retry attempts (${job.maxAttempts}) reached`,
      );
    }

    // Get document
    const document = await this.prisma.document.findUnique({
      where: { id: job.documentId },
    });

    if (!document) {
      throw new NotFoundException(`Document not found: ${job.documentId}`);
    }

    // Reset job status
    await this.prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status: 'PENDING',
        errorMessage: null,
        errorStack: null,
        completedAt: null,
        attempts: { increment: 1 },
      },
    });

    // Update document status
    await this.prisma.document.update({
      where: { id: job.documentId },
      data: { processingStatus: 'PENDING' },
    });

    // Re-add to queue
    const queue = this.getQueueForJobType(job.jobType as ProcessingJobType);

    const jobData: ProcessingJobData = {
      documentId: job.documentId,
      s3Key: document.s3Key,
      organizationId: document.organizationId,
      options: job.inputParams as Record<string, unknown>,
    };

    await queue.add(
      this.getJobNameForType(job.jobType as ProcessingJobType),
      jobData,
      { jobId },
    );

    this.logger.log(`Job ${jobId} queued for retry (attempt ${job.attempts + 1})`);

    return { success: true, message: 'Job queued for retry' };
  }

  /**
   * Cancel a pending job
   */
  async cancelJob(jobId: string): Promise<{ success: boolean; message: string }> {
    const job = await this.prisma.processingJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`Job not found: ${jobId}`);
    }

    if (job.status !== 'PENDING') {
      throw new BadRequestException(
        `Can only cancel pending jobs. Current status: ${job.status}`,
      );
    }

    // Remove from queue
    const queue = this.getQueueForJobType(job.jobType as ProcessingJobType);

    try {
      const queueJob = await queue.getJob(jobId);
      if (queueJob) {
        await queueJob.remove();
      }
    } catch (error) {
      this.logger.warn(`Could not remove job ${jobId} from queue: ${error}`);
    }

    // Also check legacy queue
    try {
      const legacyJob = await this.legacyQueue.getJob(jobId);
      if (legacyJob) {
        await legacyJob.remove();
      }
    } catch {
      // Ignore
    }

    // Update database
    await this.prisma.processingJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });

    this.logger.log(`Job ${jobId} cancelled`);

    return { success: true, message: 'Job cancelled' };
  }

  /**
   * Get aggregated queue statistics for all queues
   */
  async getQueueStats(): Promise<AggregatedQueueStats> {
    const queueStats: Record<string, QueueStats> = {};
    const totals = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    };

    // Get stats for each queue
    for (const [name, queue] of this.queues) {
      const [waiting, active, completed, failed, delayed, isPaused] =
        await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
          queue.isPaused(),
        ]);

      queueStats[name] = {
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused: isPaused,
      };

      totals.waiting += waiting;
      totals.active += active;
      totals.completed += completed;
      totals.failed += failed;
      totals.delayed += delayed;
    }

    return { queues: queueStats, totals };
  }

  /**
   * Get statistics for a specific queue
   */
  async getQueueStatsByName(queueName: string): Promise<QueueStats> {
    const queue = this.queues.get(queueName);

    if (!queue) {
      throw new NotFoundException(`Queue not found: ${queueName}`);
    }

    const [waiting, active, completed, failed, delayed, isPaused] =
      await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
        queue.isPaused(),
      ]);

    return { waiting, active, completed, failed, delayed, paused: isPaused };
  }

  /**
   * Clean up old completed and failed jobs
   */
  async cleanOldJobs(
    olderThanDays: number = 7,
  ): Promise<{ cleaned: number; errors: string[] }> {
    let totalCleaned = 0;
    const errors: string[] = [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    // Clean from database first
    const dbResult = await this.prisma.processingJob.deleteMany({
      where: {
        status: { in: ['COMPLETED', 'FAILED', 'CANCELLED'] },
        completedAt: { lt: cutoffDate },
      },
    });

    totalCleaned += dbResult.count;
    this.logger.log(`Cleaned ${dbResult.count} old jobs from database`);

    // Clean from each queue
    for (const [name, queue] of this.queues) {
      try {
        // Clean completed jobs
        const completedCleaned = await queue.clean(
          olderThanDays * 24 * 60 * 60 * 1000, // Convert days to ms
          1000, // Max jobs to clean
          'completed',
        );

        // Clean failed jobs
        const failedCleaned = await queue.clean(
          olderThanDays * 24 * 60 * 60 * 1000,
          1000,
          'failed',
        );

        totalCleaned += completedCleaned.length + failedCleaned.length;

        this.logger.log(
          `Cleaned ${completedCleaned.length} completed and ${failedCleaned.length} failed jobs from ${name}`,
        );
      } catch (error) {
        const message = `Error cleaning queue ${name}: ${(error as Error).message}`;
        this.logger.error(message);
        errors.push(message);
      }
    }

    return { cleaned: totalCleaned, errors };
  }

  /**
   * Pause a specific queue
   */
  async pauseQueue(queueName: string): Promise<{ success: boolean; message: string }> {
    const queue = this.queues.get(queueName);

    if (!queue) {
      throw new NotFoundException(`Queue not found: ${queueName}`);
    }

    await queue.pause();
    this.logger.log(`Queue ${queueName} paused`);

    return { success: true, message: `Queue ${queueName} paused` };
  }

  /**
   * Resume a paused queue
   */
  async resumeQueue(queueName: string): Promise<{ success: boolean; message: string }> {
    const queue = this.queues.get(queueName);

    if (!queue) {
      throw new NotFoundException(`Queue not found: ${queueName}`);
    }

    await queue.resume();
    this.logger.log(`Queue ${queueName} resumed`);

    return { success: true, message: `Queue ${queueName} resumed` };
  }

  /**
   * Get all jobs for a document
   */
  async getJobsByDocument(documentId: string) {
    return this.prisma.processingJob.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get failed jobs with details
   */
  async getFailedJobs(
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ jobs: unknown[]; total: number }> {
    const [jobs, total] = await Promise.all([
      this.prisma.processingJob.findMany({
        where: { status: 'FAILED' },
        include: {
          document: {
            select: { id: true, name: true },
          },
        },
        orderBy: { completedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.processingJob.count({ where: { status: 'FAILED' } }),
    ]);

    return { jobs, total };
  }

  /**
   * Drain a queue (remove all jobs)
   */
  async drainQueue(queueName: string): Promise<{ success: boolean; removed: number }> {
    const queue = this.queues.get(queueName);

    if (!queue) {
      throw new NotFoundException(`Queue not found: ${queueName}`);
    }

    // Pause first to prevent new processing
    await queue.pause();

    // Get all waiting and delayed jobs
    const waiting = await queue.getWaiting();
    const delayed = await queue.getDelayed();

    let removed = 0;

    for (const job of [...waiting, ...delayed]) {
      try {
        await job.remove();
        removed++;
      } catch {
        // Job might have already been processed
      }
    }

    // Resume the queue
    await queue.resume();

    this.logger.log(`Drained ${removed} jobs from queue ${queueName}`);

    return { success: true, removed };
  }

  /**
   * Get the queue for a job type
   */
  private getQueueForJobType(jobType: ProcessingJobType | string): Queue {
    switch (jobType) {
      case 'OCR':
        return this.ocrQueue;
      case 'PDF_SPLIT':
      case 'PDF_MERGE':
      case 'PDF_WATERMARK':
      case 'PDF_COMPRESS':
      case 'PDF_EXTRACT_PAGES':
      case 'PDF_RENDER_PAGE':
      case 'PDF_METADATA':
        return this.pdfQueue;
      case 'THUMBNAIL':
        return this.thumbnailQueue;
      case 'EMBEDDING':
        return this.embeddingQueue;
      case 'AI_CLASSIFY':
        return this.aiClassifyQueue;
      default:
        return this.legacyQueue;
    }
  }

  /**
   * Get the queue name for a job type
   */
  private getQueueNameForJobType(jobType: ProcessingJobType | string): string {
    switch (jobType) {
      case 'OCR':
        return QUEUE_NAMES.OCR;
      case 'PDF_SPLIT':
      case 'PDF_MERGE':
      case 'PDF_WATERMARK':
      case 'PDF_COMPRESS':
      case 'PDF_EXTRACT_PAGES':
      case 'PDF_RENDER_PAGE':
      case 'PDF_METADATA':
        return QUEUE_NAMES.PDF;
      case 'THUMBNAIL':
        return QUEUE_NAMES.THUMBNAIL;
      case 'EMBEDDING':
        return QUEUE_NAMES.EMBEDDING;
      case 'AI_CLASSIFY':
        return QUEUE_NAMES.AI_CLASSIFY;
      default:
        return DOCUMENT_PROCESSING_QUEUE;
    }
  }

  /**
   * Get the job name for a job type
   */
  private getJobNameForType(jobType: ProcessingJobType | string): string {
    switch (jobType) {
      case 'OCR':
        return 'ocr-document';
      case 'PDF_SPLIT':
        return 'pdf_split';
      case 'PDF_MERGE':
        return 'pdf_merge';
      case 'PDF_WATERMARK':
        return 'pdf_watermark';
      case 'PDF_COMPRESS':
        return 'pdf_compress';
      case 'PDF_EXTRACT_PAGES':
        return 'pdf_extract_pages';
      case 'PDF_RENDER_PAGE':
        return 'pdf_render_page';
      case 'PDF_METADATA':
        return 'pdf_metadata';
      case 'THUMBNAIL':
        return 'generate-thumbnail';
      case 'EMBEDDING':
        return 'generate-embedding';
      case 'AI_CLASSIFY':
        return 'classify-document';
      default:
        return jobType.toLowerCase();
    }
  }
}
