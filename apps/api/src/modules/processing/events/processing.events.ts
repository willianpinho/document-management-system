/**
 * Processing Event Listeners
 *
 * Centralized event handling for all processing queues:
 * - Job completed: Update document status, trigger downstream jobs
 * - Job failed: Log error, update status, send notifications
 * - Job stalled: Auto-retry or notify for manual intervention
 * - Job progress: Update real-time progress tracking
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, QueueEvents, Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { PrismaService } from '@/common/prisma/prisma.service';
import {
  QUEUE_NAMES,
  QueueName,
  ProcessingJobType,
} from '../queues/queue.constants';

/**
 * Event payload for job completion
 */
interface JobCompletedEvent {
  jobId: string;
  returnvalue: unknown;
}

/**
 * Event payload for job failure
 */
interface JobFailedEvent {
  jobId: string;
  failedReason: string;
}

/**
 * Event payload for job stalled
 */
interface JobStalledEvent {
  jobId: string;
}

/**
 * Event payload for job progress
 */
interface JobProgressEvent {
  jobId: string;
  data: number | Record<string, unknown>;
}

@Injectable()
export class ProcessingEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProcessingEventsService.name);
  private readonly queueEvents: Map<string, QueueEvents> = new Map();
  private readonly redis: Redis;

  constructor(
    @InjectQueue(QUEUE_NAMES.OCR) private readonly ocrQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PDF) private readonly pdfQueue: Queue,
    @InjectQueue(QUEUE_NAMES.THUMBNAIL) private readonly thumbnailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EMBEDDING) private readonly embeddingQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AI_CLASSIFY) private readonly aiClassifyQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // Create Redis connection for queue events
    this.redis = new Redis({
      host: this.configService.get<string>('redis.host', 'localhost'),
      port: this.configService.get<number>('redis.port', 6379),
      password: this.configService.get<string>('redis.password'),
      maxRetriesPerRequest: null, // Required for BullMQ
    });
  }

  /**
   * Initialize event listeners on module startup
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing processing event listeners');

    const queues: Array<{ name: QueueName; queue: Queue }> = [
      { name: QUEUE_NAMES.OCR, queue: this.ocrQueue },
      { name: QUEUE_NAMES.PDF, queue: this.pdfQueue },
      { name: QUEUE_NAMES.THUMBNAIL, queue: this.thumbnailQueue },
      { name: QUEUE_NAMES.EMBEDDING, queue: this.embeddingQueue },
      { name: QUEUE_NAMES.AI_CLASSIFY, queue: this.aiClassifyQueue },
    ];

    for (const { name } of queues) {
      await this.setupQueueEventListeners(name);
    }

    this.logger.log('Processing event listeners initialized');
  }

  /**
   * Clean up event listeners on module shutdown
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Cleaning up processing event listeners');

    for (const [name, queueEvents] of this.queueEvents) {
      try {
        await queueEvents.close();
        this.logger.debug(`Closed event listener for ${name}`);
      } catch (error) {
        this.logger.warn(`Error closing event listener for ${name}: ${(error as Error).message}`);
      }
    }

    await this.redis.quit();
    this.logger.log('Processing event listeners cleaned up');
  }

  /**
   * Setup event listeners for a specific queue
   */
  private async setupQueueEventListeners(queueName: QueueName): Promise<void> {
    const queueEvents = new QueueEvents(queueName, {
      connection: this.redis.duplicate() as any,
    });

    // Job completed
    queueEvents.on('completed', async (event: JobCompletedEvent) => {
      await this.handleJobCompleted(queueName, event);
    });

    // Job failed
    queueEvents.on('failed', async (event: JobFailedEvent) => {
      await this.handleJobFailed(queueName, event);
    });

    // Job stalled
    queueEvents.on('stalled', async (event: JobStalledEvent) => {
      await this.handleJobStalled(queueName, event);
    });

    // Job progress
    queueEvents.on('progress', async (event: any) => {
      await this.handleJobProgress(queueName, event as JobProgressEvent);
    });

    this.queueEvents.set(queueName, queueEvents);
    this.logger.debug(`Event listeners set up for queue: ${queueName}`);
  }

  /**
   * Handle job completed event
   */
  private async handleJobCompleted(
    queueName: QueueName,
    event: JobCompletedEvent,
  ): Promise<void> {
    const { jobId, returnvalue } = event;

    this.logger.log(`Job completed: ${jobId} in queue ${queueName}`);

    try {
      // Get job details from database
      const processingJob = await this.prisma.processingJob.findUnique({
        where: { id: jobId },
        include: { document: true },
      });

      if (!processingJob) {
        this.logger.warn(`Processing job not found for completed event: ${jobId}`);
        return;
      }

      // Update document status based on job type
      await this.updateDocumentAfterCompletion(
        processingJob.documentId,
        processingJob.jobType as ProcessingJobType,
        returnvalue,
      );

      // Trigger downstream jobs if needed
      await this.triggerDownstreamJobs(processingJob, returnvalue);

      // Create audit log
      await this.createAuditLog('JOB_COMPLETED', {
        jobId,
        jobType: processingJob.jobType,
        documentId: processingJob.documentId,
        queueName,
      });
    } catch (error) {
      this.logger.error(
        `Error handling job completed event for ${jobId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Handle job failed event
   */
  private async handleJobFailed(
    queueName: QueueName,
    event: JobFailedEvent,
  ): Promise<void> {
    const { jobId, failedReason } = event;

    this.logger.error(`Job failed: ${jobId} in queue ${queueName} - ${failedReason}`);

    try {
      // Get job details
      const processingJob = await this.prisma.processingJob.findUnique({
        where: { id: jobId },
      });

      if (!processingJob) {
        this.logger.warn(`Processing job not found for failed event: ${jobId}`);
        return;
      }

      // Update document status
      await this.prisma.document.update({
        where: { id: processingJob.documentId },
        data: { processingStatus: 'FAILED' },
      });

      // Create audit log for failure
      await this.createAuditLog('JOB_FAILED', {
        jobId,
        jobType: processingJob.jobType,
        documentId: processingJob.documentId,
        queueName,
        error: failedReason,
      });

      // TODO: Send notification for critical failures
      // await this.notificationService.notifyJobFailed(processingJob, failedReason);
    } catch (error) {
      this.logger.error(
        `Error handling job failed event for ${jobId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Handle job stalled event
   */
  private async handleJobStalled(
    queueName: QueueName,
    event: JobStalledEvent,
  ): Promise<void> {
    const { jobId } = event;

    this.logger.warn(`Job stalled: ${jobId} in queue ${queueName}`);

    try {
      // Get job details
      const processingJob = await this.prisma.processingJob.findUnique({
        where: { id: jobId },
      });

      if (!processingJob) {
        this.logger.warn(`Processing job not found for stalled event: ${jobId}`);
        return;
      }

      // Update job status to stalled
      await this.prisma.processingJob.update({
        where: { id: jobId },
        data: {
          status: 'STALLED',
          errorMessage: 'Job stalled - worker may have crashed',
        },
      });

      // Create audit log
      await this.createAuditLog('JOB_STALLED', {
        jobId,
        jobType: processingJob.jobType,
        documentId: processingJob.documentId,
        queueName,
      });

      // BullMQ will automatically retry stalled jobs based on stalledInterval config
      // If repeated stalls, consider alerting operations team
    } catch (error) {
      this.logger.error(
        `Error handling job stalled event for ${jobId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Handle job progress event
   */
  private async handleJobProgress(
    queueName: QueueName,
    event: JobProgressEvent,
  ): Promise<void> {
    const { jobId, data } = event;
    const progress = typeof data === 'number' ? data : (data.percentage as number) || 0;

    // Only log significant progress updates
    if (progress % 25 === 0 || progress === 100) {
      this.logger.debug(`Job ${jobId} progress: ${progress}% in queue ${queueName}`);
    }

    // Could emit real-time updates via WebSocket here
    // await this.websocketGateway.emitJobProgress(jobId, progress);
  }

  /**
   * Update document status after job completion
   */
  private async updateDocumentAfterCompletion(
    documentId: string,
    jobType: ProcessingJobType,
    result: unknown,
  ): Promise<void> {
    const statusMap: Record<ProcessingJobType, string> = {
      OCR: 'OCR_COMPLETE',
      THUMBNAIL: 'READY',
      EMBEDDING: 'INDEXED',
      AI_CLASSIFY: 'CLASSIFIED',
      PDF_SPLIT: 'READY',
      PDF_MERGE: 'READY',
    };

    const updateData: Record<string, unknown> = {
      processingStatus: statusMap[jobType] || 'READY',
    };

    // Add type-specific updates
    if (jobType === 'OCR' && result) {
      const ocrResult = result as { extractedText?: string };
      if (ocrResult.extractedText) {
        updateData.extractedText = ocrResult.extractedText;
      }
    }

    if (jobType === 'THUMBNAIL' && result) {
      const thumbResult = result as { thumbnailKey?: string };
      if (thumbResult.thumbnailKey) {
        updateData.thumbnailKey = thumbResult.thumbnailKey;
      }
    }

    await this.prisma.document.update({
      where: { id: documentId },
      data: updateData,
    });
  }

  /**
   * Trigger downstream jobs based on completed job
   */
  private async triggerDownstreamJobs(
    completedJob: { documentId: string; jobType: string; outputData: unknown },
    result: unknown,
  ): Promise<void> {
    const { documentId, jobType } = completedJob;

    // After OCR, trigger embedding generation
    if (jobType === 'OCR') {
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          s3Key: true,
          organizationId: true,
          extractedText: true,
        },
      });

      if (document?.extractedText) {
        // Check if embedding job doesn't already exist
        const existingEmbeddingJob = await this.prisma.processingJob.findFirst({
          where: {
            documentId,
            jobType: 'EMBEDDING',
            status: { in: ['PENDING', 'RUNNING'] },
          },
        });

        if (!existingEmbeddingJob) {
          this.logger.log(`Triggering embedding job after OCR for document ${documentId}`);

          // Create job record
          const embeddingJob = await this.prisma.processingJob.create({
            data: {
              documentId,
              jobType: 'EMBEDDING',
              status: 'PENDING',
              inputParams: {},
            },
          });

          // Add to queue
          await this.embeddingQueue.add('generate-embedding', {
            documentId,
            s3Key: document.s3Key,
            organizationId: document.organizationId,
          }, {
            jobId: embeddingJob.id,
            priority: 4,
          });
        }
      }
    }

    // After OCR, trigger AI classification
    if (jobType === 'OCR') {
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          s3Key: true,
          organizationId: true,
          extractedText: true,
        },
      });

      if (document?.extractedText) {
        const existingClassifyJob = await this.prisma.processingJob.findFirst({
          where: {
            documentId,
            jobType: 'AI_CLASSIFY',
            status: { in: ['PENDING', 'RUNNING'] },
          },
        });

        if (!existingClassifyJob) {
          this.logger.log(`Triggering AI classification after OCR for document ${documentId}`);

          const classifyJob = await this.prisma.processingJob.create({
            data: {
              documentId,
              jobType: 'AI_CLASSIFY',
              status: 'PENDING',
              inputParams: {},
            },
          });

          await this.aiClassifyQueue.add('classify-document', {
            documentId,
            s3Key: document.s3Key,
            organizationId: document.organizationId,
          }, {
            jobId: classifyJob.id,
            priority: 3,
          });
        }
      }
    }
  }

  /**
   * Create an audit log entry
   */
  private async createAuditLog(
    action: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: action as any,
          resourceType: 'PROCESSING_JOB' as any,
          resourceId: details.jobId as string,
          metadata: details as any,
          createdAt: new Date(),
          organizationId: (details.organizationId || details.jobId) as string,
        },
      });
    } catch (error) {
      // Don't fail on audit log errors
      this.logger.warn(`Failed to create audit log: ${(error as Error).message}`);
    }
  }
}
