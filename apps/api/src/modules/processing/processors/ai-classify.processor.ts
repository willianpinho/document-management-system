/**
 * AI Classification Processor
 *
 * Handles AI-powered document classification using GPT-4.
 * Analyzes document content to determine:
 * - Document category (Invoice, Contract, Report, etc.)
 * - Language detection
 * - Relevant tags
 * - Summary generation
 */

import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '@/common/prisma/prisma.service';
import {
  QUEUE_NAMES,
  AI_CLASSIFY_PROCESSOR_OPTIONS,
  AI_CLASSIFY_CONFIG,
} from '../queues';
import type { AiClassifyJobData, AiClassifyJobResult } from '../queues/queue.types';

@Processor(QUEUE_NAMES.AI_CLASSIFY, AI_CLASSIFY_PROCESSOR_OPTIONS)
export class AiClassifyProcessor extends WorkerHost {
  private readonly logger = new Logger(AiClassifyProcessor.name);
  private readonly openaiApiKey: string | undefined;
  private readonly model: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    super();
    this.openaiApiKey = this.configService.get<string>('openai.apiKey');
    this.model = this.configService.get<string>('openai.model', AI_CLASSIFY_CONFIG.defaultModel);
  }

  /**
   * Main process method
   */
  async process(job: Job<AiClassifyJobData>): Promise<AiClassifyJobResult> {
    const { documentId, categories, extractEntities, generateSummary } = job.data;
    const startTime = Date.now();

    this.logger.log(`Starting AI classification for document ${documentId}`);

    try {
      // Update status to running
      await this.updateJobStatus(job.id as string, 'RUNNING');
      await job.updateProgress(10);

      // Get document with extracted text
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          name: true,
          extractedText: true,
          mimeType: true,
          metadata: true,
        },
      });

      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }

      if (!document.extractedText) {
        throw new Error('Document has no extracted text. Run OCR first.');
      }

      await job.updateProgress(20);

      // Check if OpenAI is configured
      if (!this.openaiApiKey) {
        this.logger.warn('OpenAI API key not configured, skipping classification');
        return this.createEmptyResult();
      }

      // Perform classification
      const classification = await this.classifyDocument(
        document.extractedText,
        document.name,
        categories || AI_CLASSIFY_CONFIG.defaultCategories,
      );

      await job.updateProgress(60);

      // Extract entities if requested
      let entities: Record<string, string[]> | undefined;
      if (extractEntities) {
        entities = await this.extractEntities(document.extractedText);
        await job.updateProgress(80);
      }

      // Update document metadata with classification
      const existingMetadata = (document.metadata as Record<string, unknown>) || {};
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          processingStatus: 'COMPLETE',
          metadata: {
            ...existingMetadata,
            aiClassification: {
              ...classification,
              entities,
              classifiedAt: new Date().toISOString(),
              model: this.model,
            },
          } as any,
        },
      });

      await job.updateProgress(90);

      // Update job status
      const duration = Date.now() - startTime;
      await this.updateJobStatus(job.id as string, 'COMPLETED', {
        ...classification,
        entities,
        durationMs: duration,
      });

      await job.updateProgress(100);

      const result: AiClassifyJobResult = {
        category: classification.category,
        confidence: classification.confidence,
        language: classification.language,
        tags: classification.tags,
        summary: classification.summary,
        entities,
      };

      this.logger.log(
        `AI classification completed for document ${documentId}: ${classification.category} (${Math.round(classification.confidence * 100)}% confidence)`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `AI classification failed for document ${documentId}: ${(error as Error).message}`,
        (error as Error).stack,
      );

      await this.updateJobStatus(job.id as string, 'FAILED', undefined, {
        message: (error as Error).message,
        stack: (error as Error).stack,
      });

      throw error;
    }
  }

  /**
   * Classify document content
   */
  private async classifyDocument(
    text: string,
    fileName: string,
    categories: string[],
  ): Promise<{
    category: string;
    confidence: number;
    language?: string;
    tags?: string[];
    summary?: string;
  }> {
    // Truncate text to fit model's context
    const truncatedText = text.substring(0, AI_CLASSIFY_CONFIG.maxTextLength);

    const prompt = AI_CLASSIFY_CONFIG.classificationPrompt
      .replace('{fileName}', fileName)
      .replace('{content}', truncatedText)
      .replace('{categories}', categories.join(', '));

    const response = await this.callOpenAI(prompt);

    try {
      // Strip markdown code blocks if present (GPT sometimes wraps JSON in ```json blocks)
      let cleanResponse = response.trim();
      cleanResponse = cleanResponse.replace(/^```(?:json)?\s*\n?/, '');
      cleanResponse = cleanResponse.replace(/\n?\s*```\s*$/, '');
      cleanResponse = cleanResponse.trim();

      this.logger.debug(`Parsing classification response: ${cleanResponse.substring(0, 100)}...`);

      const parsed = JSON.parse(cleanResponse);
      return {
        category: parsed.category || 'Other',
        confidence: Math.min(Math.max(parsed.confidence || 0, 0), 1),
        language: parsed.language,
        tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
        summary: parsed.summary,
      };
    } catch (e) {
      this.logger.warn(`Failed to parse classification response: ${e instanceof Error ? e.message : 'Unknown'}`);
      this.logger.debug(`Raw response: ${response.substring(0, 200)}...`);
      return {
        category: 'Other',
        confidence: 0,
        tags: [],
        summary: response.substring(0, 200),
      };
    }
  }

  /**
   * Extract named entities from document
   */
  private async extractEntities(
    text: string,
  ): Promise<Record<string, string[]>> {
    const truncatedText = text.substring(0, AI_CLASSIFY_CONFIG.maxTextLength);

    const prompt = `Extract named entities from the following document text.

Text: ${truncatedText}

Return a JSON object with these entity types as keys:
- persons: Names of people
- organizations: Company/organization names
- locations: Places, addresses
- dates: Important dates mentioned
- amounts: Monetary amounts
- references: Document/reference numbers

Return only the JSON object, no additional text. Example:
{
  "persons": ["John Smith", "Jane Doe"],
  "organizations": ["Acme Corp"],
  "locations": ["New York, NY"],
  "dates": ["2024-01-15"],
  "amounts": ["$1,500.00"],
  "references": ["INV-2024-001"]
}`;

    const response = await this.callOpenAI(prompt);

    try {
      const parsed = JSON.parse(response);
      // Ensure all values are string arrays
      const result: Record<string, string[]> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (Array.isArray(value)) {
          result[key] = value.map(String);
        }
      }
      return result;
    } catch {
      this.logger.warn('Failed to parse entity extraction response');
      return {};
    }
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: AI_CLASSIFY_CONFIG.temperature,
        max_tokens: AI_CLASSIFY_CONFIG.maxResponseTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0].message.content;
  }

  /**
   * Create empty result when classification is skipped
   */
  private createEmptyResult(): AiClassifyJobResult {
    return {
      category: 'Unknown',
      confidence: 0,
      tags: [],
    };
  }

  /**
   * Update job status in database
   */
  private async updateJobStatus(
    jobId: string,
    status: 'RUNNING' | 'COMPLETED' | 'FAILED',
    outputData?: Record<string, unknown>,
    errorData?: { message: string; stack?: string },
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
      this.logger.warn(`Failed to update job status for ${jobId}: ${(error as Error).message}`);
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<AiClassifyJobData>): void {
    this.logger.log(`AI classification job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<AiClassifyJobData>, error: Error): void {
    this.logger.error(`AI classification job ${job.id} failed: ${error.message}`, error.stack);
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string): void {
    this.logger.warn(`AI classification job ${jobId} stalled`);
  }
}
