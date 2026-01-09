/**
 * Processing Module
 *
 * Provides document processing capabilities using BullMQ job queues:
 * - OCR: Text extraction using AWS Textract
 * - PDF: PDF split, merge, and page operations
 * - Thumbnail: Image thumbnail generation
 * - Embedding: Vector embedding generation for semantic search
 * - AI Classification: Document categorization using GPT-4
 *
 * Each queue has its own:
 * - Concurrency limits
 * - Rate limiting
 * - Retry configuration
 * - Dedicated processor
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { ProcessingController } from './processing.controller';
import { ProcessingService } from './processing.service';

// Processors
import { OcrProcessor } from './processors/ocr.processor';
import { ThumbnailProcessor } from './processors/thumbnail.processor';
import { PdfProcessor } from './processors/pdf.processor';
import { EmbeddingProcessor } from './processors/embedding.processor';
import { AiClassifyProcessor } from './processors/ai-classify.processor';

// Services
import { TextractService } from './services/textract.service';
import { EmbeddingService } from './services/embedding.service';
import { PdfService } from './services/pdf.service';

// Events
import { ProcessingEventsService } from './events/processing.events';

// Queue configurations
import {
  QUEUE_NAMES,
  DOCUMENT_PROCESSING_QUEUE,
  OCR_QUEUE_CONFIG,
  PDF_QUEUE_CONFIG,
  THUMBNAIL_QUEUE_CONFIG,
  EMBEDDING_QUEUE_CONFIG,
  AI_CLASSIFY_QUEUE_CONFIG,
  JOB_CLEANUP_CONFIG,
  DEFAULT_RETRY_CONFIG,
} from './queues';

import { StorageModule } from '../storage/storage.module';

// Re-export for backward compatibility
export { DOCUMENT_PROCESSING_QUEUE } from './queues';

@Module({
  imports: [
    StorageModule,

    // BullMQ Root Configuration
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host', 'localhost'),
          port: configService.get<number>('redis.port', 6379),
          password: configService.get<string>('redis.password'),
          maxRetriesPerRequest: null, // Required for BullMQ
          enableReadyCheck: false,
          retryStrategy: (times: number) => {
            // Exponential backoff with max 30 seconds
            return Math.min(times * 1000, 30000);
          },
        },
        defaultJobOptions: {
          ...DEFAULT_RETRY_CONFIG,
          removeOnComplete: JOB_CLEANUP_CONFIG.removeOnComplete,
          removeOnFail: JOB_CLEANUP_CONFIG.removeOnFail,
        },
      }),
      inject: [ConfigService],
    }),

    // Legacy queue (for backward compatibility during migration)
    BullModule.registerQueue({
      name: DOCUMENT_PROCESSING_QUEUE,
      defaultJobOptions: {
        ...DEFAULT_RETRY_CONFIG,
        removeOnComplete: JOB_CLEANUP_CONFIG.removeOnComplete,
        removeOnFail: JOB_CLEANUP_CONFIG.removeOnFail,
      },
    }),

    // OCR Queue - Text extraction using AWS Textract
    // Rate limited to 10/min, concurrency 2
    BullModule.registerQueue(OCR_QUEUE_CONFIG),

    // PDF Queue - PDF operations (split, merge, extract)
    // No rate limit, concurrency 5
    BullModule.registerQueue(PDF_QUEUE_CONFIG),

    // Thumbnail Queue - Image thumbnail generation
    // No rate limit, concurrency 10
    BullModule.registerQueue(THUMBNAIL_QUEUE_CONFIG),

    // Embedding Queue - Vector embedding generation
    // Rate limited to 60/min, concurrency 3
    BullModule.registerQueue(EMBEDDING_QUEUE_CONFIG),

    // AI Classification Queue - Document categorization
    // Rate limited to 20/min, concurrency 2
    BullModule.registerQueue(AI_CLASSIFY_QUEUE_CONFIG),
  ],

  controllers: [ProcessingController],

  providers: [
    // Main processing service
    ProcessingService,

    // Specialized services
    TextractService,
    EmbeddingService,
    PdfService,

    // Event listeners
    ProcessingEventsService,

    // Job processors
    OcrProcessor,
    ThumbnailProcessor,
    PdfProcessor,
    EmbeddingProcessor,
    AiClassifyProcessor,
  ],

  exports: [
    ProcessingService,
    TextractService,
    EmbeddingService,
    PdfService,
  ],
})
export class ProcessingModule {}
