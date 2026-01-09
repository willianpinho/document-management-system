import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';

import { PrismaService } from '@/common/prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { DOCUMENT_PROCESSING_QUEUE } from '../queues/queue.constants';
import type { ProcessingJobData } from '../processing.service';

const THUMBNAIL_SIZES = {
  small: { width: 100, height: 100 },
  medium: { width: 300, height: 300 },
  large: { width: 600, height: 600 },
};

@Processor(DOCUMENT_PROCESSING_QUEUE)
export class ThumbnailProcessor extends WorkerHost {
  private readonly logger = new Logger(ThumbnailProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job<ProcessingJobData>): Promise<{ thumbnailKey: string }> {
    if (job.name !== 'thumbnail') {
      throw new Error(`Processor cannot handle job type: ${job.name}`);
    }

    const { documentId, s3Key, organizationId, options } = job.data;
    this.logger.log(`Generating thumbnail for document ${documentId}`);

    await job.updateProgress(10);

    try {
      await this.prisma.processingJob.update({
        where: { id: job.id as string },
        data: { status: 'RUNNING', startedAt: new Date() },
      });

      await job.updateProgress(20);

      // Get the original file from S3
      const fileStream = await this.storageService.getObject(s3Key);
      const chunks: Buffer[] = [];

      for await (const chunk of fileStream as AsyncIterable<Buffer>) {
        chunks.push(chunk);
      }
      const fileBuffer = Buffer.concat(chunks);

      await job.updateProgress(40);

      // Determine thumbnail size
      const size = (options?.size as keyof typeof THUMBNAIL_SIZES) || 'medium';
      const dimensions = THUMBNAIL_SIZES[size] || THUMBNAIL_SIZES.medium;

      // Generate thumbnail using Sharp
      const thumbnailBuffer = await sharp(fileBuffer)
        .resize(dimensions.width, dimensions.height, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .png()
        .toBuffer();

      await job.updateProgress(70);

      // Upload thumbnail to S3
      const thumbnailKey = `${organizationId}/thumbnails/${documentId}_${size}.png`;
      await this.storageService.uploadBuffer(thumbnailKey, thumbnailBuffer, 'image/png');

      await job.updateProgress(90);

      // Update document with thumbnail key
      await this.prisma.document.update({
        where: { id: documentId },
        data: { thumbnailKey },
      });

      // Update job status
      await this.prisma.processingJob.update({
        where: { id: job.id as string },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          outputData: {
            thumbnailKey,
            size,
            dimensions,
          },
        },
      });

      await job.updateProgress(100);

      this.logger.log(`Thumbnail generated for document ${documentId}`);
      return { thumbnailKey };
    } catch (error) {
      this.logger.error(`Thumbnail generation failed for document ${documentId}`, error);

      await this.prisma.processingJob.update({
        where: { id: job.id as string },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ProcessingJobData>, error: Error) {
    this.logger.error(`Thumbnail job ${job.id} failed: ${error.message}`);
  }
}
