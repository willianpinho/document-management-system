import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * PDF document metadata
 */
export class PdfMetadataDto {
  @ApiProperty({ description: 'Total number of pages in the PDF' })
  pageCount: number;

  @ApiPropertyOptional({ description: 'Document title' })
  title?: string;

  @ApiPropertyOptional({ description: 'Document author' })
  author?: string;

  @ApiPropertyOptional({ description: 'Document subject' })
  subject?: string;

  @ApiPropertyOptional({ description: 'Document keywords' })
  keywords?: string;

  @ApiPropertyOptional({ description: 'Document creator application' })
  creator?: string;

  @ApiPropertyOptional({ description: 'PDF producer' })
  producer?: string;

  @ApiPropertyOptional({ description: 'Document creation date' })
  creationDate?: Date;

  @ApiPropertyOptional({ description: 'Document modification date' })
  modificationDate?: Date;

  @ApiProperty({ description: 'PDF version' })
  pdfVersion: string;

  @ApiProperty({ description: 'Whether the PDF is encrypted' })
  isEncrypted: boolean;

  @ApiProperty({ description: 'Whether the PDF has form fields' })
  hasFormFields: boolean;

  @ApiProperty({ description: 'Whether the PDF is linearized (web optimized)' })
  isLinearized: boolean;

  @ApiPropertyOptional({ description: 'Page dimensions (first page)' })
  pageDimensions?: {
    width: number;
    height: number;
    unit: 'points' | 'inches' | 'mm';
  };

  @ApiPropertyOptional({ description: 'Outline/bookmarks structure', type: 'array' })
  outline?: PdfOutlineItemDto[];
}

/**
 * PDF outline/bookmark item
 */
export class PdfOutlineItemDto {
  @ApiProperty({ description: 'Bookmark title' })
  title: string;

  @ApiPropertyOptional({ description: 'Target page number (1-indexed)' })
  pageNumber?: number;

  @ApiPropertyOptional({ description: 'Child bookmarks', type: [PdfOutlineItemDto] })
  children?: PdfOutlineItemDto[];
}

/**
 * Result of a split document operation
 */
export class SplitOutputDocumentDto {
  @ApiProperty({ description: 'S3 key of the split document' })
  s3Key: string;

  @ApiProperty({ description: 'Page range included in this split' })
  pageRange: string;

  @ApiProperty({ description: 'Number of pages in this split' })
  pageCount: number;

  @ApiPropertyOptional({ description: 'Created document ID' })
  documentId?: string;

  @ApiPropertyOptional({ description: 'Filename of the split document' })
  filename?: string;

  @ApiProperty({ description: 'Size in bytes' })
  sizeBytes: number;
}

/**
 * Result of a PDF split operation
 */
export class SplitResultDto {
  @ApiProperty({
    description: 'Output documents from the split operation',
    type: [SplitOutputDocumentDto],
  })
  outputDocuments: SplitOutputDocumentDto[];

  @ApiProperty({ description: 'Total number of split documents created' })
  totalSplits: number;

  @ApiProperty({ description: 'Source document ID' })
  sourceDocumentId: string;

  @ApiProperty({ description: 'Total pages in source document' })
  sourceTotalPages: number;

  @ApiProperty({ description: 'Processing duration in milliseconds' })
  processingTimeMs: number;
}

/**
 * Result of a PDF merge operation
 */
export class MergeResultDto {
  @ApiProperty({ description: 'S3 key of the merged document' })
  s3Key: string;

  @ApiProperty({ description: 'Document ID of the merged document' })
  documentId: string;

  @ApiProperty({ description: 'Total page count of merged document' })
  pageCount: number;

  @ApiProperty({ description: 'Size in bytes' })
  sizeBytes: number;

  @ApiProperty({ description: 'Source document IDs that were merged' })
  sourceDocumentIds: string[];

  @ApiProperty({ description: 'Filename of merged document' })
  filename: string;

  @ApiProperty({ description: 'Processing duration in milliseconds' })
  processingTimeMs: number;
}

/**
 * Result of page extraction operation
 */
export class ExtractPagesResultDto {
  @ApiProperty({ description: 'S3 key of the extracted pages document' })
  s3Key: string;

  @ApiPropertyOptional({ description: 'Document ID of the extracted document' })
  documentId?: string;

  @ApiProperty({ description: 'Pages that were extracted' })
  extractedPages: number[];

  @ApiProperty({ description: 'Total page count of output document' })
  pageCount: number;

  @ApiProperty({ description: 'Size in bytes' })
  sizeBytes: number;

  @ApiProperty({ description: 'Filename' })
  filename: string;

  @ApiProperty({ description: 'Processing duration in milliseconds' })
  processingTimeMs: number;
}

/**
 * Result of watermark operation
 */
export class WatermarkResultDto {
  @ApiProperty({ description: 'S3 key of the watermarked document' })
  s3Key: string;

  @ApiPropertyOptional({ description: 'Document ID of watermarked document' })
  documentId?: string;

  @ApiProperty({ description: 'Number of pages watermarked' })
  pagesWatermarked: number;

  @ApiProperty({ description: 'Watermark text applied' })
  watermarkText: string;

  @ApiProperty({ description: 'Size in bytes' })
  sizeBytes: number;

  @ApiProperty({ description: 'Processing duration in milliseconds' })
  processingTimeMs: number;
}

/**
 * Result of compression operation
 */
export class CompressionResultDto {
  @ApiProperty({ description: 'S3 key of the compressed document' })
  s3Key: string;

  @ApiPropertyOptional({ description: 'Document ID of compressed document' })
  documentId?: string;

  @ApiProperty({ description: 'Original size in bytes' })
  originalSizeBytes: number;

  @ApiProperty({ description: 'Compressed size in bytes' })
  compressedSizeBytes: number;

  @ApiProperty({ description: 'Compression ratio (0-1)' })
  compressionRatio: number;

  @ApiProperty({ description: 'Percentage saved' })
  percentageSaved: number;

  @ApiProperty({ description: 'Processing duration in milliseconds' })
  processingTimeMs: number;
}

/**
 * Result of page render operation
 */
export class PageRenderResultDto {
  @ApiProperty({ description: 'S3 key of the rendered image' })
  s3Key: string;

  @ApiProperty({ description: 'Page number that was rendered' })
  pageNumber: number;

  @ApiProperty({ description: 'Image width in pixels' })
  width: number;

  @ApiProperty({ description: 'Image height in pixels' })
  height: number;

  @ApiProperty({ description: 'Image format' })
  format: string;

  @ApiProperty({ description: 'Size in bytes' })
  sizeBytes: number;

  @ApiPropertyOptional({ description: 'Pre-signed download URL' })
  downloadUrl?: string;

  @ApiProperty({ description: 'Processing duration in milliseconds' })
  processingTimeMs: number;
}

/**
 * Generic processing job result wrapper
 */
export class ProcessingJobResultDto<T = unknown> {
  @ApiProperty({ description: 'Job ID' })
  jobId: string;

  @ApiProperty({ description: 'Job status' })
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

  @ApiPropertyOptional({ description: 'Progress percentage (0-100)' })
  progress?: number;

  @ApiPropertyOptional({ description: 'Result data' })
  result?: T;

  @ApiPropertyOptional({ description: 'Error message if failed' })
  error?: string;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt: Date;

  @ApiPropertyOptional({ description: 'Started at timestamp' })
  startedAt?: Date;

  @ApiPropertyOptional({ description: 'Completed at timestamp' })
  completedAt?: Date;
}
