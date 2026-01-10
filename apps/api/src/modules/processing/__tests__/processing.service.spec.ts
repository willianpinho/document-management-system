/**
 * ProcessingService Unit Tests
 *
 * Tests for document processing job management including queue operations,
 * job status tracking, retry logic, and cancellation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';

// Mock @prisma/client before importing services
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({})),
  DocumentStatus: {
    UPLOADED: 'UPLOADED',
    PROCESSING: 'PROCESSING',
    READY: 'READY',
    ERROR: 'ERROR',
    DELETED: 'DELETED',
  },
  ProcessingStatus: {
    PENDING: 'PENDING',
    OCR_IN_PROGRESS: 'OCR_IN_PROGRESS',
    AI_CLASSIFYING: 'AI_CLASSIFYING',
    EMBEDDING: 'EMBEDDING',
    COMPLETE: 'COMPLETE',
    FAILED: 'FAILED',
  },
  Prisma: {},
}));

import { ProcessingService, ProcessingJobData } from '../processing.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import {
  DOCUMENT_PROCESSING_QUEUE,
  QUEUE_NAMES,
  ProcessingJobType,
} from '../queues/queue.constants';

// Mock factory for Queue
const createMockQueue = () => ({
  add: vi.fn(),
  getJob: vi.fn(),
  getWaitingCount: vi.fn(),
  getActiveCount: vi.fn(),
  getCompletedCount: vi.fn(),
  getFailedCount: vi.fn(),
  getDelayedCount: vi.fn(),
  getWaiting: vi.fn(),
  getDelayed: vi.fn(),
  isPaused: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  clean: vi.fn(),
});

// Mock factory for PrismaService
const createMockPrismaService = () => ({
  document: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  processingJob: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn(),
  },
});

// Test fixtures
const mockOrganizationId = '550e8400-e29b-41d4-a716-446655440000';
const mockDocumentId = '660e8400-e29b-41d4-a716-446655440001';
const mockJobId = '770e8400-e29b-41d4-a716-446655440002';

const mockDocument = {
  id: mockDocumentId,
  organizationId: mockOrganizationId,
  s3Key: `${mockOrganizationId}/uuid/document.pdf`,
  mimeType: 'application/pdf',
  sizeBytes: BigInt(1024),
};

const mockProcessingJob = {
  id: mockJobId,
  documentId: mockDocumentId,
  jobType: 'OCR',
  status: 'PENDING',
  attempts: 0,
  maxAttempts: 3,
  inputParams: {},
  outputData: null,
  errorMessage: null,
  errorStack: null,
  createdAt: new Date('2025-01-01'),
  startedAt: null,
  completedAt: null,
};

describe('ProcessingService', () => {
  let service: ProcessingService;
  let prismaService: ReturnType<typeof createMockPrismaService>;
  let legacyQueue: ReturnType<typeof createMockQueue>;
  let ocrQueue: ReturnType<typeof createMockQueue>;
  let pdfQueue: ReturnType<typeof createMockQueue>;
  let thumbnailQueue: ReturnType<typeof createMockQueue>;
  let embeddingQueue: ReturnType<typeof createMockQueue>;
  let aiClassifyQueue: ReturnType<typeof createMockQueue>;

  beforeEach(async () => {
    prismaService = createMockPrismaService();
    legacyQueue = createMockQueue();
    ocrQueue = createMockQueue();
    pdfQueue = createMockQueue();
    thumbnailQueue = createMockQueue();
    embeddingQueue = createMockQueue();
    aiClassifyQueue = createMockQueue();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessingService,
        { provide: PrismaService, useValue: prismaService },
        { provide: getQueueToken(DOCUMENT_PROCESSING_QUEUE), useValue: legacyQueue },
        { provide: getQueueToken(QUEUE_NAMES.OCR), useValue: ocrQueue },
        { provide: getQueueToken(QUEUE_NAMES.PDF), useValue: pdfQueue },
        { provide: getQueueToken(QUEUE_NAMES.THUMBNAIL), useValue: thumbnailQueue },
        { provide: getQueueToken(QUEUE_NAMES.EMBEDDING), useValue: embeddingQueue },
        { provide: getQueueToken(QUEUE_NAMES.AI_CLASSIFY), useValue: aiClassifyQueue },
      ],
    }).compile();

    service = module.get<ProcessingService>(ProcessingService);

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('addJob', () => {
    beforeEach(() => {
      prismaService.document.findUnique.mockResolvedValue(mockDocument);
      prismaService.processingJob.create.mockResolvedValue(mockProcessingJob);
      prismaService.document.update.mockResolvedValue(mockDocument);
    });

    it('should create processing job and add to OCR queue', async () => {
      ocrQueue.add.mockResolvedValue({ id: 'queue-job-id' });

      const result = await service.addJob(mockDocumentId, 'OCR');

      expect(result).toHaveProperty('job');
      expect(result).toHaveProperty('queueJobId', 'queue-job-id');
      expect(result).toHaveProperty('queueName', QUEUE_NAMES.OCR);
      expect(result).toHaveProperty('message', 'Processing job created');

      expect(ocrQueue.add).toHaveBeenCalledWith(
        'ocr-document',
        expect.objectContaining({
          documentId: mockDocumentId,
          s3Key: mockDocument.s3Key,
          organizationId: mockOrganizationId,
        }),
        expect.any(Object),
      );
    });

    it('should route PDF_SPLIT jobs to PDF queue', async () => {
      pdfQueue.add.mockResolvedValue({ id: 'queue-job-id' });

      await service.addJob(mockDocumentId, 'PDF_SPLIT');

      expect(pdfQueue.add).toHaveBeenCalledWith(
        'pdf_split',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should route THUMBNAIL jobs to thumbnail queue', async () => {
      thumbnailQueue.add.mockResolvedValue({ id: 'queue-job-id' });

      await service.addJob(mockDocumentId, 'THUMBNAIL');

      expect(thumbnailQueue.add).toHaveBeenCalledWith(
        'generate-thumbnail',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should route EMBEDDING jobs to embedding queue', async () => {
      embeddingQueue.add.mockResolvedValue({ id: 'queue-job-id' });

      await service.addJob(mockDocumentId, 'EMBEDDING');

      expect(embeddingQueue.add).toHaveBeenCalledWith(
        'generate-embedding',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should route AI_CLASSIFY jobs to AI classify queue', async () => {
      aiClassifyQueue.add.mockResolvedValue({ id: 'queue-job-id' });

      await service.addJob(mockDocumentId, 'AI_CLASSIFY');

      expect(aiClassifyQueue.add).toHaveBeenCalledWith(
        'classify-document',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should throw NotFoundException when document not found', async () => {
      prismaService.document.findUnique.mockResolvedValue(null);

      await expect(service.addJob('non-existent', 'OCR')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update document processing status to PENDING', async () => {
      ocrQueue.add.mockResolvedValue({ id: 'queue-job-id' });

      await service.addJob(mockDocumentId, 'OCR');

      expect(prismaService.document.update).toHaveBeenCalledWith({
        where: { id: mockDocumentId },
        data: { processingStatus: 'PENDING' },
      });
    });

    it('should pass processing options to job data', async () => {
      ocrQueue.add.mockResolvedValue({ id: 'queue-job-id' });
      const options = { language: 'en', features: ['TABLES'] };

      await service.addJob(mockDocumentId, 'OCR', options);

      expect(ocrQueue.add).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ options }),
        expect.any(Object),
      );
    });

    it('should apply custom priority when provided', async () => {
      ocrQueue.add.mockResolvedValue({ id: 'queue-job-id' });

      await service.addJob(mockDocumentId, 'OCR', undefined, { priority: 1 });

      expect(ocrQueue.add).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ priority: 1 }),
      );
    });

    it('should apply delay when provided', async () => {
      ocrQueue.add.mockResolvedValue({ id: 'queue-job-id' });

      await service.addJob(mockDocumentId, 'OCR', undefined, { delay: 5000 });

      expect(ocrQueue.add).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ delay: 5000 }),
      );
    });

    it('should create database record for job tracking', async () => {
      ocrQueue.add.mockResolvedValue({ id: 'queue-job-id' });

      await service.addJob(mockDocumentId, 'OCR');

      expect(prismaService.processingJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          documentId: mockDocumentId,
          jobType: 'OCR',
          status: 'PENDING',
        }),
      });
    });
  });

  describe('getJobStatus', () => {
    it('should return job status with document info', async () => {
      const jobWithDocument = {
        ...mockProcessingJob,
        document: {
          id: mockDocumentId,
          name: 'test.pdf',
          status: 'uploaded',
          processingStatus: 'PENDING',
        },
      };

      prismaService.processingJob.findUnique.mockResolvedValue(jobWithDocument);
      ocrQueue.getJob.mockResolvedValue({
        progress: 50,
        getState: vi.fn().mockResolvedValue('active'),
      });

      const result = await service.getJobStatus(mockJobId);

      expect(result).toHaveProperty('id', mockJobId);
      expect(result).toHaveProperty('documentId', mockDocumentId);
      expect(result).toHaveProperty('jobType', 'OCR');
      expect(result).toHaveProperty('status', 'PENDING');
      expect(result).toHaveProperty('queueState', 'active');
      expect(result).toHaveProperty('progress', 50);
      expect(result).toHaveProperty('document');
    });

    it('should throw NotFoundException when job not found', async () => {
      prismaService.processingJob.findUnique.mockResolvedValue(null);

      await expect(service.getJobStatus('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return null queue state when job not in queue', async () => {
      prismaService.processingJob.findUnique.mockResolvedValue(mockProcessingJob);
      ocrQueue.getJob.mockResolvedValue(null);
      legacyQueue.getJob.mockResolvedValue(null);

      const result = await service.getJobStatus(mockJobId);

      expect(result.queueState).toBeNull();
    });

    it('should check legacy queue if not found in primary queue', async () => {
      prismaService.processingJob.findUnique.mockResolvedValue(mockProcessingJob);
      ocrQueue.getJob.mockResolvedValue(null);
      legacyQueue.getJob.mockResolvedValue({
        progress: 0,
        getState: vi.fn().mockResolvedValue('waiting'),
      });

      const result = await service.getJobStatus(mockJobId);

      expect(result.queueState).toBe('waiting');
    });
  });

  describe('retryJob', () => {
    beforeEach(() => {
      prismaService.document.findUnique.mockResolvedValue(mockDocument);
    });

    it('should retry failed job', async () => {
      const failedJob = { ...mockProcessingJob, status: 'FAILED', attempts: 1 };
      prismaService.processingJob.findUnique.mockResolvedValue(failedJob);
      prismaService.processingJob.update.mockResolvedValue({ ...failedJob, status: 'PENDING' });
      prismaService.document.update.mockResolvedValue(mockDocument);
      ocrQueue.add.mockResolvedValue({ id: 'new-queue-job' });

      const result = await service.retryJob(mockJobId);

      expect(result).toEqual({ success: true, message: 'Job queued for retry' });
    });

    it('should throw NotFoundException when job not found', async () => {
      prismaService.processingJob.findUnique.mockResolvedValue(null);

      await expect(service.retryJob('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when job is not failed', async () => {
      prismaService.processingJob.findUnique.mockResolvedValue({
        ...mockProcessingJob,
        status: 'COMPLETED',
      });

      await expect(service.retryJob(mockJobId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when max retries exceeded', async () => {
      prismaService.processingJob.findUnique.mockResolvedValue({
        ...mockProcessingJob,
        status: 'FAILED',
        attempts: 3,
        maxAttempts: 3,
      });

      await expect(service.retryJob(mockJobId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should increment attempt count on retry', async () => {
      const failedJob = { ...mockProcessingJob, status: 'FAILED', attempts: 1 };
      prismaService.processingJob.findUnique.mockResolvedValue(failedJob);
      prismaService.processingJob.update.mockResolvedValue({});
      prismaService.document.update.mockResolvedValue(mockDocument);
      ocrQueue.add.mockResolvedValue({ id: 'new-queue-job' });

      await service.retryJob(mockJobId);

      expect(prismaService.processingJob.update).toHaveBeenCalledWith({
        where: { id: mockJobId },
        data: expect.objectContaining({
          status: 'PENDING',
          errorMessage: null,
          errorStack: null,
          completedAt: null,
          attempts: { increment: 1 },
        }),
      });
    });

    it('should throw NotFoundException when document not found', async () => {
      const failedJob = { ...mockProcessingJob, status: 'FAILED', attempts: 1 };
      prismaService.processingJob.findUnique.mockResolvedValue(failedJob);
      prismaService.processingJob.update.mockResolvedValue({});
      prismaService.document.findUnique.mockResolvedValue(null);

      await expect(service.retryJob(mockJobId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelJob', () => {
    it('should cancel pending job', async () => {
      prismaService.processingJob.findUnique.mockResolvedValue(mockProcessingJob);
      ocrQueue.getJob.mockResolvedValue({
        remove: vi.fn().mockResolvedValue(undefined),
      });
      prismaService.processingJob.update.mockResolvedValue({
        ...mockProcessingJob,
        status: 'CANCELLED',
      });

      const result = await service.cancelJob(mockJobId);

      expect(result).toEqual({ success: true, message: 'Job cancelled' });
    });

    it('should throw NotFoundException when job not found', async () => {
      prismaService.processingJob.findUnique.mockResolvedValue(null);

      await expect(service.cancelJob('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when job is not pending', async () => {
      prismaService.processingJob.findUnique.mockResolvedValue({
        ...mockProcessingJob,
        status: 'RUNNING',
      });

      await expect(service.cancelJob(mockJobId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should remove job from queue', async () => {
      const mockRemove = vi.fn().mockResolvedValue(undefined);
      prismaService.processingJob.findUnique.mockResolvedValue(mockProcessingJob);
      ocrQueue.getJob.mockResolvedValue({ remove: mockRemove });
      prismaService.processingJob.update.mockResolvedValue({});

      await service.cancelJob(mockJobId);

      expect(mockRemove).toHaveBeenCalled();
    });

    it('should update job status to CANCELLED', async () => {
      prismaService.processingJob.findUnique.mockResolvedValue(mockProcessingJob);
      ocrQueue.getJob.mockResolvedValue(null);
      legacyQueue.getJob.mockResolvedValue(null);
      prismaService.processingJob.update.mockResolvedValue({});

      await service.cancelJob(mockJobId);

      expect(prismaService.processingJob.update).toHaveBeenCalledWith({
        where: { id: mockJobId },
        data: { status: 'CANCELLED', completedAt: expect.any(Date) },
      });
    });

    it('should handle missing queue job gracefully', async () => {
      prismaService.processingJob.findUnique.mockResolvedValue(mockProcessingJob);
      ocrQueue.getJob.mockResolvedValue(null);
      legacyQueue.getJob.mockResolvedValue(null);
      prismaService.processingJob.update.mockResolvedValue({});

      const result = await service.cancelJob(mockJobId);

      expect(result.success).toBe(true);
    });
  });

  describe('getQueueStats', () => {
    beforeEach(() => {
      const setupQueue = (queue: ReturnType<typeof createMockQueue>) => {
        queue.getWaitingCount.mockResolvedValue(5);
        queue.getActiveCount.mockResolvedValue(2);
        queue.getCompletedCount.mockResolvedValue(100);
        queue.getFailedCount.mockResolvedValue(3);
        queue.getDelayedCount.mockResolvedValue(1);
        queue.isPaused.mockResolvedValue(false);
      };

      setupQueue(legacyQueue);
      setupQueue(ocrQueue);
      setupQueue(pdfQueue);
      setupQueue(thumbnailQueue);
      setupQueue(embeddingQueue);
      setupQueue(aiClassifyQueue);
    });

    it('should return aggregated stats for all queues', async () => {
      const result = await service.getQueueStats();

      expect(result).toHaveProperty('queues');
      expect(result).toHaveProperty('totals');
      expect(result.totals).toEqual({
        waiting: 30, // 5 * 6 queues
        active: 12,
        completed: 600,
        failed: 18,
        delayed: 6,
      });
    });

    it('should include individual queue stats', async () => {
      const result = await service.getQueueStats();

      expect(result.queues[QUEUE_NAMES.OCR]).toEqual({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
        paused: false,
      });
    });
  });

  describe('getQueueStatsByName', () => {
    it('should return stats for specific queue', async () => {
      ocrQueue.getWaitingCount.mockResolvedValue(10);
      ocrQueue.getActiveCount.mockResolvedValue(3);
      ocrQueue.getCompletedCount.mockResolvedValue(50);
      ocrQueue.getFailedCount.mockResolvedValue(2);
      ocrQueue.getDelayedCount.mockResolvedValue(0);
      ocrQueue.isPaused.mockResolvedValue(false);

      const result = await service.getQueueStatsByName(QUEUE_NAMES.OCR);

      expect(result).toEqual({
        waiting: 10,
        active: 3,
        completed: 50,
        failed: 2,
        delayed: 0,
        paused: false,
      });
    });

    it('should throw NotFoundException for unknown queue', async () => {
      await expect(service.getQueueStatsByName('unknown-queue')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('cleanOldJobs', () => {
    it('should clean old jobs from database and queues', async () => {
      prismaService.processingJob.deleteMany.mockResolvedValue({ count: 50 });

      const allQueues = [legacyQueue, ocrQueue, pdfQueue, thumbnailQueue, embeddingQueue, aiClassifyQueue];
      allQueues.forEach((queue) => {
        queue.clean.mockResolvedValue(['job1', 'job2']);
      });

      const result = await service.cleanOldJobs(7);

      expect(result).toHaveProperty('cleaned');
      expect(result).toHaveProperty('errors');
      expect(result.cleaned).toBeGreaterThan(0);
    });

    it('should delete jobs older than specified days', async () => {
      prismaService.processingJob.deleteMany.mockResolvedValue({ count: 0 });

      await service.cleanOldJobs(14);

      expect(prismaService.processingJob.deleteMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['COMPLETED', 'FAILED', 'CANCELLED'] },
          completedAt: { lt: expect.any(Date) },
        },
      });
    });

    it('should collect errors from queue cleaning', async () => {
      prismaService.processingJob.deleteMany.mockResolvedValue({ count: 0 });
      ocrQueue.clean.mockRejectedValue(new Error('Redis connection failed'));

      const result = await service.cleanOldJobs(7);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Redis connection failed');
    });
  });

  describe('pauseQueue', () => {
    it('should pause specified queue', async () => {
      ocrQueue.pause.mockResolvedValue(undefined);

      const result = await service.pauseQueue(QUEUE_NAMES.OCR);

      expect(result).toEqual({
        success: true,
        message: `Queue ${QUEUE_NAMES.OCR} paused`,
      });
      expect(ocrQueue.pause).toHaveBeenCalled();
    });

    it('should throw NotFoundException for unknown queue', async () => {
      await expect(service.pauseQueue('unknown-queue')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('resumeQueue', () => {
    it('should resume specified queue', async () => {
      ocrQueue.resume.mockResolvedValue(undefined);

      const result = await service.resumeQueue(QUEUE_NAMES.OCR);

      expect(result).toEqual({
        success: true,
        message: `Queue ${QUEUE_NAMES.OCR} resumed`,
      });
      expect(ocrQueue.resume).toHaveBeenCalled();
    });

    it('should throw NotFoundException for unknown queue', async () => {
      await expect(service.resumeQueue('unknown-queue')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getJobsByDocument', () => {
    it('should return all jobs for a document', async () => {
      const jobs = [
        { ...mockProcessingJob, jobType: 'OCR' },
        { ...mockProcessingJob, id: 'job-2', jobType: 'THUMBNAIL' },
      ];

      prismaService.processingJob.findMany.mockResolvedValue(jobs);

      const result = await service.getJobsByDocument(mockDocumentId);

      expect(result).toHaveLength(2);
      expect(prismaService.processingJob.findMany).toHaveBeenCalledWith({
        where: { documentId: mockDocumentId },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getFailedJobs', () => {
    it('should return paginated failed jobs', async () => {
      const failedJobs = [
        { ...mockProcessingJob, status: 'FAILED', document: { id: mockDocumentId, name: 'test.pdf' } },
      ];

      prismaService.processingJob.findMany.mockResolvedValue(failedJobs);
      prismaService.processingJob.count.mockResolvedValue(10);

      const result = await service.getFailedJobs(10, 0);

      expect(result).toEqual({ jobs: failedJobs, total: 10 });
      expect(prismaService.processingJob.findMany).toHaveBeenCalledWith({
        where: { status: 'FAILED' },
        include: { document: { select: { id: true, name: true } } },
        orderBy: { completedAt: 'desc' },
        take: 10,
        skip: 0,
      });
    });
  });

  describe('drainQueue', () => {
    it('should remove all waiting and delayed jobs', async () => {
      const mockJob1 = { remove: vi.fn() };
      const mockJob2 = { remove: vi.fn() };

      ocrQueue.pause.mockResolvedValue(undefined);
      ocrQueue.getWaiting.mockResolvedValue([mockJob1]);
      ocrQueue.getDelayed.mockResolvedValue([mockJob2]);
      ocrQueue.resume.mockResolvedValue(undefined);

      const result = await service.drainQueue(QUEUE_NAMES.OCR);

      expect(result).toEqual({ success: true, removed: 2 });
      expect(mockJob1.remove).toHaveBeenCalled();
      expect(mockJob2.remove).toHaveBeenCalled();
    });

    it('should pause and resume queue during drain', async () => {
      ocrQueue.pause.mockResolvedValue(undefined);
      ocrQueue.getWaiting.mockResolvedValue([]);
      ocrQueue.getDelayed.mockResolvedValue([]);
      ocrQueue.resume.mockResolvedValue(undefined);

      await service.drainQueue(QUEUE_NAMES.OCR);

      expect(ocrQueue.pause).toHaveBeenCalled();
      expect(ocrQueue.resume).toHaveBeenCalled();
    });

    it('should throw NotFoundException for unknown queue', async () => {
      await expect(service.drainQueue('unknown-queue')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle job removal errors gracefully', async () => {
      const mockJob1 = { remove: vi.fn().mockRejectedValue(new Error('Already removed')) };
      const mockJob2 = { remove: vi.fn() };

      ocrQueue.pause.mockResolvedValue(undefined);
      ocrQueue.getWaiting.mockResolvedValue([mockJob1, mockJob2]);
      ocrQueue.getDelayed.mockResolvedValue([]);
      ocrQueue.resume.mockResolvedValue(undefined);

      const result = await service.drainQueue(QUEUE_NAMES.OCR);

      // Only job2 should be counted as removed
      expect(result.removed).toBe(1);
    });
  });
});
