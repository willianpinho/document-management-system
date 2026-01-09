import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TextractClient,
  DetectDocumentTextCommand,
  AnalyzeDocumentCommand,
  StartDocumentAnalysisCommand,
  GetDocumentAnalysisCommand,
  FeatureType,
  Block,
  BlockType,
  DocumentLocation,
  NotificationChannel,
  OutputConfig,
  EntityType,
} from '@aws-sdk/client-textract';

import {
  OcrResult,
  OcrTextBlock,
  OcrTable,
  OcrTableRow,
  OcrTableCell,
  OcrFormField,
  OcrSignature,
  OcrPage,
  OcrProcessingOptions,
  TextractJobStatus,
  RawTextractBlock,
  Geometry,
  BoundingBox,
  PolygonPoint,
  isSupportedOcrMimeType,
} from '../dto/ocr-result.dto';

/**
 * AWS Textract Service
 *
 * Provides complete document text extraction, table detection, and form parsing
 * using AWS Textract. Supports both synchronous (single-page) and asynchronous
 * (multi-page) document processing.
 */
@Injectable()
export class TextractService {
  private readonly logger = new Logger(TextractService.name);
  private readonly client: TextractClient;
  private readonly bucket: string;
  private readonly snsTopicArn: string | undefined;
  private readonly roleArn: string | undefined;
  private readonly outputBucket: string | undefined;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');

    this.client = new TextractClient({
      region,
      // Credentials are picked up from environment or IAM role
    });

    this.bucket = this.configService.get<string>('S3_BUCKET', 'dms-documents-dev');
    this.snsTopicArn = this.configService.get<string>('TEXTRACT_SNS_TOPIC_ARN');
    this.roleArn = this.configService.get<string>('TEXTRACT_ROLE_ARN');
    this.outputBucket = this.configService.get<string>(
      'TEXTRACT_OUTPUT_BUCKET',
      this.bucket,
    );

    this.logger.log(`TextractService initialized for region: ${region}`);
  }

  /**
   * Detect text in a single-page document (synchronous)
   * Use for images and single-page PDFs under 5MB
   */
  async detectDocumentText(
    s3Key: string,
    s3Bucket?: string,
  ): Promise<{ text: string; blocks: Block[]; confidence: number }> {
    const bucket = s3Bucket || this.bucket;

    this.logger.log(`Detecting text in document: ${bucket}/${s3Key}`);

    const command = new DetectDocumentTextCommand({
      Document: {
        S3Object: {
          Bucket: bucket,
          Name: s3Key,
        },
      },
    });

    const response = await this.client.send(command);
    const blocks = response.Blocks || [];

    // Extract text from LINE blocks to preserve reading order
    const text = blocks
      .filter((b) => b.BlockType === 'LINE')
      .sort((a, b) => {
        const pageA = a.Page || 1;
        const pageB = b.Page || 1;
        if (pageA !== pageB) return pageA - pageB;

        const yA = a.Geometry?.BoundingBox?.Top || 0;
        const yB = b.Geometry?.BoundingBox?.Top || 0;
        if (Math.abs(yA - yB) > 0.01) return yA - yB;

        const xA = a.Geometry?.BoundingBox?.Left || 0;
        const xB = b.Geometry?.BoundingBox?.Left || 0;
        return xA - xB;
      })
      .map((b) => b.Text)
      .join('\n');

    // Calculate average confidence
    const confidences = blocks
      .filter((b) => b.Confidence !== undefined)
      .map((b) => b.Confidence!);
    const confidence =
      confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : 0;

    this.logger.log(
      `Detected ${blocks.length} blocks with ${confidence.toFixed(1)}% confidence`,
    );

    return { text, blocks, confidence };
  }

  /**
   * Analyze a single-page document with forms and tables (synchronous)
   * Use for images and single-page PDFs under 5MB
   */
  async analyzeDocument(
    s3Key: string,
    features: FeatureType[] = ['FORMS', 'TABLES'],
    s3Bucket?: string,
  ): Promise<OcrResult> {
    const bucket = s3Bucket || this.bucket;
    const startTime = Date.now();

    this.logger.log(
      `Analyzing document: ${bucket}/${s3Key} with features: ${features.join(', ')}`,
    );

    const command = new AnalyzeDocumentCommand({
      Document: {
        S3Object: {
          Bucket: bucket,
          Name: s3Key,
        },
      },
      FeatureTypes: features,
    });

    const response = await this.client.send(command);
    const blocks = response.Blocks || [];

    return this.parseTextractResponse(blocks, {
      processingTimeMs: Date.now() - startTime,
      featureTypes: features,
    });
  }

  /**
   * Start asynchronous document analysis for multi-page PDFs
   * Returns a job ID that can be polled for results
   */
  async startDocumentAnalysis(
    s3Key: string,
    options: OcrProcessingOptions = { features: ['TABLES', 'FORMS'] },
    s3Bucket?: string,
  ): Promise<string> {
    const bucket = s3Bucket || this.bucket;

    this.logger.log(
      `Starting async analysis for: ${bucket}/${s3Key} with features: ${options.features.join(', ')}`,
    );

    const documentLocation: DocumentLocation = {
      S3Object: {
        Bucket: bucket,
        Name: s3Key,
      },
    };

    // Map feature strings to FeatureType enum
    const featureTypes: FeatureType[] = options.features.map((f) => f as FeatureType);

    // Build command input
    const commandInput: {
      DocumentLocation: DocumentLocation;
      FeatureTypes: FeatureType[];
      NotificationChannel?: NotificationChannel;
      OutputConfig?: OutputConfig;
      JobTag?: string;
    } = {
      DocumentLocation: documentLocation,
      FeatureTypes: featureTypes,
    };

    // Add notification channel if configured
    if (this.snsTopicArn && this.roleArn) {
      commandInput.NotificationChannel = {
        SNSTopicArn: options.notificationTopicArn || this.snsTopicArn,
        RoleArn: this.roleArn,
      };
    }

    // Add output config for storing results
    if (this.outputBucket) {
      const outputPrefix = options.outputPrefix || `textract-output/${Date.now()}`;
      commandInput.OutputConfig = {
        S3Bucket: this.outputBucket,
        S3Prefix: outputPrefix,
      };
    }

    // Add job tag for tracking
    commandInput.JobTag = s3Key.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 64);

    const command = new StartDocumentAnalysisCommand(commandInput);
    const response = await this.client.send(command);

    if (!response.JobId) {
      throw new Error('Textract did not return a job ID');
    }

    this.logger.log(`Started Textract job: ${response.JobId}`);
    return response.JobId;
  }

  /**
   * Get the status and results of an async document analysis job
   * Returns null if job is still in progress
   */
  async getDocumentAnalysis(jobId: string): Promise<OcrResult | null> {
    const startTime = Date.now();
    let nextToken: string | undefined;
    const allBlocks: Block[] = [];
    let jobStatus: TextractJobStatus | undefined;

    this.logger.log(`Getting results for Textract job: ${jobId}`);

    do {
      const command = new GetDocumentAnalysisCommand({
        JobId: jobId,
        NextToken: nextToken,
      });

      const response = await this.client.send(command);

      // Check job status
      if (response.JobStatus === 'IN_PROGRESS') {
        this.logger.debug(`Job ${jobId} still in progress`);
        return null;
      }

      if (response.JobStatus === 'FAILED') {
        const errorMessage = response.StatusMessage || 'Unknown Textract error';
        this.logger.error(`Textract job ${jobId} failed: ${errorMessage}`);
        throw new Error(`Textract job failed: ${errorMessage}`);
      }

      // Collect status info
      if (!jobStatus) {
        jobStatus = {
          jobId,
          status: response.JobStatus as TextractJobStatus['status'],
          statusMessage: response.StatusMessage,
          warnings: response.Warnings?.map((w) => w.ErrorCode || 'Unknown warning'),
        };
      }

      // Collect blocks
      if (response.Blocks) {
        allBlocks.push(...response.Blocks);
      }

      nextToken = response.NextToken;
    } while (nextToken);

    this.logger.log(
      `Retrieved ${allBlocks.length} blocks from job ${jobId}`,
    );

    const result = this.parseTextractResponse(allBlocks, {
      processingTimeMs: Date.now() - startTime,
      featureTypes: ['TABLES', 'FORMS'],
    });

    result.textractJobId = jobId;
    result.status = 'completed';

    return result;
  }

  /**
   * Poll for job completion with exponential backoff
   */
  async waitForJobCompletion(
    jobId: string,
    maxWaitMs: number = 300000, // 5 minutes
    pollIntervalMs: number = 5000, // 5 seconds
  ): Promise<OcrResult> {
    const startTime = Date.now();
    let waitTime = pollIntervalMs;

    while (Date.now() - startTime < maxWaitMs) {
      const result = await this.getDocumentAnalysis(jobId);

      if (result !== null) {
        return result;
      }

      // Wait with exponential backoff (max 30 seconds)
      await this.sleep(waitTime);
      waitTime = Math.min(waitTime * 1.5, 30000);
    }

    throw new Error(`Textract job ${jobId} did not complete within ${maxWaitMs}ms`);
  }

  /**
   * Parse Textract response blocks into structured OcrResult
   */
  parseTextractResponse(
    blocks: Block[],
    metadata: { processingTimeMs: number; featureTypes: string[] },
  ): OcrResult {
    const blockMap = new Map<string, Block>(
      blocks.filter((b) => b.Id).map((b) => [b.Id!, b]),
    );

    // Extract text
    const { text, textBlocks } = this.extractText(blocks);

    // Extract tables
    const tables = this.extractTables(blocks, blockMap);

    // Extract form fields
    const formFields = this.extractForms(blocks, blockMap);

    // Extract signatures
    const signatures = this.extractSignatures(blocks);

    // Extract page information
    const pages = this.extractPages(blocks);

    // Calculate statistics
    const wordCount = blocks.filter((b) => b.BlockType === 'WORD').length;
    const characterCount = text.length;

    // Calculate overall confidence
    const confidences = blocks
      .filter((b) => b.Confidence !== undefined)
      .map((b) => b.Confidence!);
    const confidence =
      confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : 0;

    return {
      id: `ocr-${Date.now()}`,
      documentId: '',
      status: 'completed',
      text,
      textBlocks,
      tables,
      formFields,
      signatures,
      pages,
      pageCount: pages.length || 1,
      confidence,
      wordCount,
      characterCount,
      detectedLanguages: [], // Textract doesn't provide language detection
      metadata: {
        processingTimeMs: metadata.processingTimeMs,
        textractApiVersion: '2018-06-27',
        featureTypes: metadata.featureTypes,
        rawBlockCount: blocks.length,
      },
      startedAt: new Date(),
      completedAt: new Date(),
    };
  }

  /**
   * Extract plain text and text blocks from Textract response
   */
  extractText(blocks: Block[]): { text: string; textBlocks: OcrTextBlock[] } {
    const textBlocks: OcrTextBlock[] = [];

    // Filter and sort LINE blocks
    const lineBlocks = blocks
      .filter((b) => b.BlockType === 'LINE')
      .sort((a, b) => {
        const pageA = a.Page || 1;
        const pageB = b.Page || 1;
        if (pageA !== pageB) return pageA - pageB;

        const yA = a.Geometry?.BoundingBox?.Top || 0;
        const yB = b.Geometry?.BoundingBox?.Top || 0;
        if (Math.abs(yA - yB) > 0.01) return yA - yB;

        const xA = a.Geometry?.BoundingBox?.Left || 0;
        const xB = b.Geometry?.BoundingBox?.Left || 0;
        return xA - xB;
      });

    for (const block of lineBlocks) {
      if (block.Id && block.Text) {
        textBlocks.push({
          id: block.Id,
          blockType: 'LINE',
          text: block.Text,
          confidence: block.Confidence || 0,
          geometry: this.parseGeometry(block.Geometry),
          page: block.Page || 1,
          childIds: block.Relationships?.find((r) => r.Type === 'CHILD')?.Ids,
        });
      }
    }

    // Also add WORD blocks for granular access
    for (const block of blocks.filter((b) => b.BlockType === 'WORD')) {
      if (block.Id && block.Text) {
        textBlocks.push({
          id: block.Id,
          blockType: 'WORD',
          text: block.Text,
          confidence: block.Confidence || 0,
          geometry: this.parseGeometry(block.Geometry),
          page: block.Page || 1,
        });
      }
    }

    const text = lineBlocks.map((b) => b.Text).join('\n');

    return { text, textBlocks };
  }

  /**
   * Extract tables from Textract response
   */
  extractTables(blocks: Block[], blockMap: Map<string, Block>): OcrTable[] {
    const tables: OcrTable[] = [];
    const tableBlocks = blocks.filter((b) => b.BlockType === 'TABLE');

    for (const tableBlock of tableBlocks) {
      if (!tableBlock.Id) continue;

      // Get all cell IDs for this table
      const cellIds =
        tableBlock.Relationships?.find((r) => r.Type === 'CHILD')?.Ids || [];

      const cellBlocks = cellIds
        .map((id) => blockMap.get(id))
        .filter((b): b is Block => b !== undefined && b.BlockType === 'CELL');

      // Build rows
      const rowMap = new Map<number, OcrTableCell[]>();
      let maxRow = 0;
      let maxCol = 0;

      for (const cell of cellBlocks) {
        const rowIndex = cell.RowIndex || 1;
        const colIndex = cell.ColumnIndex || 1;

        maxRow = Math.max(maxRow, rowIndex);
        maxCol = Math.max(maxCol, colIndex);

        // Get cell text
        const cellText = this.getCellText(cell, blockMap);

        const tableCell: OcrTableCell = {
          rowIndex,
          columnIndex: colIndex,
          rowSpan: cell.RowSpan || 1,
          columnSpan: cell.ColumnSpan || 1,
          text: cellText,
          confidence: cell.Confidence || 0,
          isHeader: rowIndex === 1, // First row is header by default
          geometry: this.parseGeometry(cell.Geometry),
        };

        if (!rowMap.has(rowIndex)) {
          rowMap.set(rowIndex, []);
        }
        rowMap.get(rowIndex)!.push(tableCell);
      }

      // Convert to rows array
      const rows: OcrTableRow[] = [];
      for (let r = 1; r <= maxRow; r++) {
        const cells = rowMap.get(r) || [];
        cells.sort((a, b) => a.columnIndex - b.columnIndex);
        rows.push({ rowIndex: r, cells });
      }

      // Calculate table confidence
      const cellConfidences = cellBlocks
        .filter((c) => c.Confidence !== undefined)
        .map((c) => c.Confidence!);
      const tableConfidence =
        cellConfidences.length > 0
          ? cellConfidences.reduce((a, b) => a + b, 0) / cellConfidences.length
          : 0;

      tables.push({
        id: tableBlock.Id,
        page: tableBlock.Page || 1,
        rowCount: maxRow,
        columnCount: maxCol,
        rows,
        confidence: tableConfidence,
        geometry: this.parseGeometry(tableBlock.Geometry),
      });
    }

    return tables;
  }

  /**
   * Extract form key-value pairs from Textract response
   */
  extractForms(blocks: Block[], blockMap: Map<string, Block>): OcrFormField[] {
    const formFields: OcrFormField[] = [];

    // Find KEY_VALUE_SET blocks that are KEYs
    const keyBlocks = blocks.filter(
      (b) =>
        b.BlockType === 'KEY_VALUE_SET' && b.EntityTypes?.includes('KEY'),
    );

    for (const keyBlock of keyBlocks) {
      if (!keyBlock.Id) continue;

      // Get the key text
      const keyText = this.getKeyValueText(keyBlock, blockMap, 'CHILD');

      // Find the corresponding VALUE block
      const valueBlockId = keyBlock.Relationships?.find(
        (r) => r.Type === 'VALUE',
      )?.Ids?.[0];

      let valueText = '';
      let valueConfidence = 0;
      let valueGeometry: Geometry | undefined;

      if (valueBlockId) {
        const valueBlock = blockMap.get(valueBlockId);
        if (valueBlock) {
          valueText = this.getKeyValueText(valueBlock, blockMap, 'CHILD');
          valueConfidence = valueBlock.Confidence || 0;
          valueGeometry = this.parseGeometry(valueBlock.Geometry);
        }
      }

      if (keyText.trim()) {
        formFields.push({
          key: keyText.trim(),
          value: valueText.trim(),
          keyConfidence: keyBlock.Confidence || 0,
          valueConfidence,
          keyGeometry: this.parseGeometry(keyBlock.Geometry),
          valueGeometry,
          page: keyBlock.Page || 1,
        });
      }
    }

    return formFields;
  }

  /**
   * Extract detected signatures
   */
  extractSignatures(blocks: Block[]): OcrSignature[] {
    return blocks
      .filter(
        (b) =>
          b.BlockType === 'SIGNATURE' ||
          (b.BlockType === 'KEY_VALUE_SET' &&
            b.EntityTypes?.includes('SIGNATURE' as EntityType)),
      )
      .map((b) => ({
        id: b.Id || `sig-${Date.now()}`,
        page: b.Page || 1,
        confidence: b.Confidence || 0,
        geometry: this.parseGeometry(b.Geometry),
      }));
  }

  /**
   * Extract page information
   */
  extractPages(blocks: Block[]): OcrPage[] {
    const pageMap = new Map<number, { lines: number; words: number; blocks: number }>();

    for (const block of blocks) {
      const pageNum = block.Page || 1;

      if (!pageMap.has(pageNum)) {
        pageMap.set(pageNum, { lines: 0, words: 0, blocks: 0 });
      }

      const pageStats = pageMap.get(pageNum)!;
      pageStats.blocks++;

      if (block.BlockType === 'LINE') pageStats.lines++;
      if (block.BlockType === 'WORD') pageStats.words++;
    }

    return Array.from(pageMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([pageNum, stats]) => ({
        pageNumber: pageNum,
        width: 1, // Normalized width
        height: 1, // Normalized height
        textBlockCount: stats.blocks,
        lineCount: stats.lines,
        wordCount: stats.words,
      }));
  }

  /**
   * Helper: Parse geometry from Textract block
   */
  private parseGeometry(
    geometry: Block['Geometry'] | undefined,
  ): Geometry {
    const defaultGeometry: Geometry = {
      boundingBox: { width: 0, height: 0, left: 0, top: 0 },
      polygon: [],
    };

    if (!geometry) return defaultGeometry;

    const boundingBox: BoundingBox = {
      width: geometry.BoundingBox?.Width || 0,
      height: geometry.BoundingBox?.Height || 0,
      left: geometry.BoundingBox?.Left || 0,
      top: geometry.BoundingBox?.Top || 0,
    };

    const polygon: PolygonPoint[] =
      geometry.Polygon?.map((p) => ({
        x: p.X || 0,
        y: p.Y || 0,
      })) || [];

    return { boundingBox, polygon };
  }

  /**
   * Helper: Get text content from a table cell
   */
  private getCellText(cell: Block, blockMap: Map<string, Block>): string {
    const wordIds =
      cell.Relationships?.find((r) => r.Type === 'CHILD')?.Ids || [];

    return wordIds
      .map((id) => blockMap.get(id))
      .filter((b): b is Block => b !== undefined)
      .map((b) => b.Text || '')
      .join(' ');
  }

  /**
   * Helper: Get text from key-value set blocks
   */
  private getKeyValueText(
    block: Block,
    blockMap: Map<string, Block>,
    relationshipType: string,
  ): string {
    const childIds =
      block.Relationships?.find((r) => r.Type === relationshipType)?.Ids || [];

    return childIds
      .map((id) => blockMap.get(id))
      .filter((b): b is Block => b !== undefined)
      .map((b) => {
        // If it's a WORD block, return the text
        if (b.BlockType === 'WORD') {
          return b.Text || '';
        }
        // If it's a selection element, return checked status
        if (b.BlockType === 'SELECTION_ELEMENT') {
          return b.SelectionStatus === 'SELECTED' ? '[X]' : '[ ]';
        }
        return '';
      })
      .join(' ');
  }

  /**
   * Helper: Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validate that a document is supported for OCR
   */
  validateDocument(mimeType: string, sizeBytes: number): void {
    if (!isSupportedOcrMimeType(mimeType)) {
      throw new Error(
        `Unsupported file type for OCR: ${mimeType}. Supported types: PDF, JPEG, PNG, TIFF`,
      );
    }

    // Textract limits
    const maxSyncSize = 5 * 1024 * 1024; // 5MB for sync
    const maxAsyncSize = 500 * 1024 * 1024; // 500MB for async

    if (sizeBytes > maxAsyncSize) {
      throw new Error(
        `File too large for OCR: ${(sizeBytes / 1024 / 1024).toFixed(2)}MB. Maximum: 500MB`,
      );
    }
  }

  /**
   * Determine if document should use async processing
   */
  shouldUseAsyncProcessing(
    mimeType: string,
    sizeBytes: number,
    options?: OcrProcessingOptions,
  ): boolean {
    if (options?.forceAsync) return true;

    // PDFs always use async (can be multi-page)
    if (mimeType === 'application/pdf') return true;

    // Files over 5MB must use async
    const maxSyncSize = 5 * 1024 * 1024;
    if (sizeBytes > maxSyncSize) return true;

    return false;
  }
}
