import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '@/common/prisma/prisma.service';
import { EmbeddingService } from '../services/embedding.service';
import { DOCUMENT_PROCESSING_QUEUE } from '../queues/queue.constants';
import type { ProcessingJobData } from '../processing.service';

interface EmbeddingResult {
  embeddingDimensions: number;
  tokensUsed: number;
  chunksProcessed: number;
}

interface ClassificationResult {
  category: string;
  confidence: number;
  language: string;
  tags: string[];
  summary: string;
}

/**
 * Embedding Processor
 *
 * Handles two types of jobs:
 * 1. embedding - Generates vector embeddings for documents using OpenAI
 * 2. ai_classify - Classifies documents using GPT-4
 *
 * For large documents, uses chunking strategy to:
 * - Split text into manageable chunks
 * - Generate embeddings for each chunk
 * - Combine using weighted average
 */
@Processor(DOCUMENT_PROCESSING_QUEUE)
export class EmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbeddingProcessor.name);
  private readonly openaiApiKey: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly configService: ConfigService,
  ) {
    super();
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');
  }

  async process(job: Job<ProcessingJobData>): Promise<EmbeddingResult> {
    if (job.name !== 'embedding' && job.name !== 'ai_classify') {
      throw new Error(`Processor cannot handle job type: ${job.name}`);
    }

    if (job.name === 'ai_classify') {
      return this.handleAiClassify(job);
    }

    return this.handleEmbedding(job);
  }

  // ===========================================================================
  // EMBEDDING GENERATION
  // ===========================================================================

  private async handleEmbedding(job: Job<ProcessingJobData>): Promise<EmbeddingResult> {
    const { documentId } = job.data;
    this.logger.log(`Generating embeddings for document ${documentId}`);

    await job.updateProgress(10);

    try {
      // Update job status
      await this.updateJobStatus(job.id as string, 'RUNNING');

      // Update document processing status
      await this.prisma.document.update({
        where: { id: documentId },
        data: { processingStatus: 'EMBEDDING_IN_PROGRESS' },
      });

      // Get document with extracted text
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        throw new Error('Document not found');
      }

      if (!document.extractedText) {
        throw new Error('Document has no extracted text. Run OCR first.');
      }

      await job.updateProgress(30);

      // Check if embedding service is available
      if (!this.embeddingService.isAvailable()) {
        this.logger.warn('Embedding service not available (missing OpenAI API key)');
        await this.updateJobStatus(job.id as string, 'COMPLETED', {
          skipped: true,
          reason: 'OpenAI API key not configured',
        });
        return { embeddingDimensions: 0, tokensUsed: 0, chunksProcessed: 0 };
      }

      await job.updateProgress(50);

      // Generate and store embedding using the EmbeddingService
      const result = await this.embeddingService.generateAndStoreEmbedding(
        documentId,
        document.extractedText,
        {
          model: this.configService.get<string>(
            'OPENAI_EMBEDDING_MODEL',
            'text-embedding-3-small',
          ) as 'text-embedding-ada-002' | 'text-embedding-3-small' | 'text-embedding-3-large',
          dimensions: 1536,
          aggregateChunks: true,
        },
      );

      await job.updateProgress(90);

      // Update document status
      await this.prisma.document.update({
        where: { id: documentId },
        data: { processingStatus: 'COMPLETE' },
      });

      // Prepare result metadata
      const outputData = {
        embeddingDimensions: result?.dimensions || 0,
        tokensUsed: result?.tokenCount || 0,
        chunksProcessed: result?.chunkInfo?.totalChunks || 1,
        textLength: document.extractedText.length,
        model: result?.model,
        wasTruncated: result?.wasTruncated || false,
      };

      // Update job status
      await this.updateJobStatus(job.id as string, 'COMPLETED', outputData);

      await job.updateProgress(100);

      this.logger.log(
        `Embeddings generated for document ${documentId}: ${result?.dimensions || 0} dimensions`,
      );

      return {
        embeddingDimensions: result?.dimensions || 0,
        tokensUsed: result?.tokenCount || 0,
        chunksProcessed: result?.chunkInfo?.totalChunks || 1,
      };
    } catch (error) {
      this.logger.error(`Embedding generation failed for document ${documentId}`, error);

      await this.prisma.document.update({
        where: { id: documentId },
        data: { processingStatus: 'FAILED' },
      });

      await this.updateJobStatus(job.id as string, 'FAILED', undefined, error);
      throw error;
    }
  }

  // ===========================================================================
  // AI CLASSIFICATION
  // ===========================================================================

  private async handleAiClassify(
    job: Job<ProcessingJobData>,
  ): Promise<EmbeddingResult> {
    const { documentId } = job.data;
    this.logger.log(`AI classifying document ${documentId}`);

    await job.updateProgress(10);

    try {
      await this.updateJobStatus(job.id as string, 'RUNNING');

      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        throw new Error('Document not found');
      }

      await job.updateProgress(30);

      let classification: ClassificationResult | Record<string, unknown> = {};

      if (this.openaiApiKey && document.extractedText) {
        classification = await this.classifyDocument(document.extractedText, document.name);
        await job.updateProgress(70);

        // Update document metadata with classification
        const currentMetadata = (document.metadata as Record<string, unknown>) || {};
        await this.prisma.document.update({
          where: { id: documentId },
          data: {
            metadata: {
              ...currentMetadata,
              aiClassification: classification,
              classifiedAt: new Date().toISOString(),
            } as any,
          },
        });
      } else {
        this.logger.warn('OpenAI API key not configured or no text, skipping classification');
      }

      await job.updateProgress(90);

      await this.updateJobStatus(job.id as string, 'COMPLETED', classification as unknown as Record<string, unknown>);

      await job.updateProgress(100);

      this.logger.log(`AI classification completed for document ${documentId}`);
      return { embeddingDimensions: 0, tokensUsed: 0, chunksProcessed: 0 };
    } catch (error) {
      this.logger.error(`AI classification failed for document ${documentId}`, error);

      await this.updateJobStatus(job.id as string, 'FAILED', undefined, error);
      throw error;
    }
  }

  private async classifyDocument(
    text: string,
    fileName: string,
  ): Promise<ClassificationResult | Record<string, unknown>> {
    const model = this.configService.get<string>('OPENAI_MODEL', 'gpt-4-turbo-preview');

    // Use first part of text for classification
    const sampleText = text.substring(0, 3000);

    const prompt = `Analyze the following document and provide a classification.

Document Name: ${fileName}
Content (sample): ${sampleText}

Provide a JSON response with:
- category: The document category (e.g., "Invoice", "Contract", "Report", "Letter", "Receipt", "Form", "Presentation", "Spreadsheet", "Image", "Other")
- confidence: Confidence score 0-1
- language: Detected language code (e.g., "en", "pt", "es", "fr", "de")
- tags: Array of 3-5 relevant tags describing the content
- summary: Brief 1-2 sentence summary of the document

Respond only with valid JSON, no markdown formatting.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.openaiApiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices[0].message.content;

    try {
      return JSON.parse(content) as ClassificationResult;
    } catch {
      this.logger.warn('Failed to parse classification response as JSON');
      return { raw: content, parseError: true };
    }
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private async updateJobStatus(
    jobId: string,
    status: 'RUNNING' | 'COMPLETED' | 'FAILED',
    outputData?: Record<string, unknown>,
    error?: unknown,
  ): Promise<void> {
    const updateData: Record<string, unknown> = { status };

    if (status === 'RUNNING') {
      updateData.startedAt = new Date();
    } else if (status === 'COMPLETED' || status === 'FAILED') {
      updateData.completedAt = new Date();
    }

    if (outputData) {
      updateData.outputData = outputData;
    }

    if (error) {
      updateData.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      updateData.errorStack = error instanceof Error ? error.stack : undefined;
    }

    try {
      await this.prisma.processingJob.update({
        where: { id: jobId },
        data: updateData,
      });
    } catch (e) {
      this.logger.warn(`Failed to update job status: ${e}`);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ProcessingJobData>, error: Error) {
    this.logger.error(`Embedding job ${job.id} failed: ${error.message}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<ProcessingJobData>, result: EmbeddingResult) {
    this.logger.log(
      `Embedding job ${job.id} completed: ${result.embeddingDimensions} dimensions, ${result.chunksProcessed} chunks`,
    );
  }
}
