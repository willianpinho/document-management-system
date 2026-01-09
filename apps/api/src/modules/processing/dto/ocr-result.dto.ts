/**
 * OCR Result DTOs for AWS Textract integration
 *
 * These types represent the structured output from Textract document analysis
 * including text blocks, tables, forms, and confidence scores.
 */

/**
 * Bounding box coordinates for a detected element
 */
export interface BoundingBox {
  width: number;
  height: number;
  left: number;
  top: number;
}

/**
 * Polygon point for precise element boundaries
 */
export interface PolygonPoint {
  x: number;
  y: number;
}

/**
 * Geometry information for detected elements
 */
export interface Geometry {
  boundingBox: BoundingBox;
  polygon: PolygonPoint[];
}

/**
 * Individual text block extracted from document
 */
export interface OcrTextBlock {
  id: string;
  blockType: 'PAGE' | 'LINE' | 'WORD';
  text: string;
  confidence: number;
  geometry: Geometry;
  page: number;
  parentId?: string;
  childIds?: string[];
}

/**
 * Individual cell within a table
 */
export interface OcrTableCell {
  rowIndex: number;
  columnIndex: number;
  rowSpan: number;
  columnSpan: number;
  text: string;
  confidence: number;
  isHeader: boolean;
  geometry?: Geometry;
}

/**
 * Table row containing cells
 */
export interface OcrTableRow {
  rowIndex: number;
  cells: OcrTableCell[];
}

/**
 * Complete table structure
 */
export interface OcrTable {
  id: string;
  page: number;
  rowCount: number;
  columnCount: number;
  rows: OcrTableRow[];
  confidence: number;
  geometry?: Geometry;
}

/**
 * Key-value pair from form fields
 */
export interface OcrFormField {
  key: string;
  value: string;
  keyConfidence: number;
  valueConfidence: number;
  keyGeometry?: Geometry;
  valueGeometry?: Geometry;
  page: number;
}

/**
 * Detected signature information
 */
export interface OcrSignature {
  id: string;
  page: number;
  confidence: number;
  geometry: Geometry;
}

/**
 * Page-level information
 */
export interface OcrPage {
  pageNumber: number;
  width: number;
  height: number;
  textBlockCount: number;
  lineCount: number;
  wordCount: number;
}

/**
 * Complete OCR result from document analysis
 */
export interface OcrResult {
  /** Unique identifier for this OCR result */
  id: string;

  /** Document ID this result belongs to */
  documentId: string;

  /** Textract job ID for async operations */
  textractJobId?: string;

  /** Processing status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed';

  /** Full extracted text, preserving reading order */
  text: string;

  /** Individual text blocks with positions */
  textBlocks: OcrTextBlock[];

  /** Extracted tables */
  tables: OcrTable[];

  /** Form key-value pairs */
  formFields: OcrFormField[];

  /** Detected signatures */
  signatures: OcrSignature[];

  /** Page information */
  pages: OcrPage[];

  /** Total page count */
  pageCount: number;

  /** Overall confidence score (0-100) */
  confidence: number;

  /** Word count */
  wordCount: number;

  /** Character count */
  characterCount: number;

  /** Languages detected */
  detectedLanguages: string[];

  /** Processing metadata */
  metadata: {
    processingTimeMs: number;
    textractApiVersion: string;
    featureTypes: string[];
    documentType?: string;
    rawBlockCount: number;
  };

  /** Timestamps */
  startedAt: Date;
  completedAt?: Date;

  /** Error information if failed */
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

/**
 * Options for OCR processing
 */
export interface OcrProcessingOptions {
  /** Feature types to extract */
  features: ('TABLES' | 'FORMS' | 'SIGNATURES')[];

  /** Whether to force async processing even for single-page documents */
  forceAsync?: boolean;

  /** Custom SNS topic for notifications (overrides default) */
  notificationTopicArn?: string;

  /** Output prefix for Textract results in S3 */
  outputPrefix?: string;

  /** Maximum pages to process (0 = all) */
  maxPages?: number;

  /** Whether to generate embeddings after OCR */
  generateEmbeddings?: boolean;

  /** Whether to run AI classification after OCR */
  runClassification?: boolean;
}

/**
 * Textract job status response
 */
export interface TextractJobStatus {
  jobId: string;
  status: 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'PARTIAL_SUCCESS';
  statusMessage?: string;
  percentComplete?: number;
  warnings?: string[];
}

/**
 * Document embedding for semantic search
 */
export interface DocumentEmbedding {
  /** Document ID */
  documentId: string;

  /** Embedding model used */
  model: string;

  /** Vector dimensions */
  dimensions: number;

  /** The embedding vector */
  vector: number[];

  /** Text that was embedded */
  sourceText: string;

  /** Token count of source text */
  tokenCount: number;

  /** Whether text was truncated */
  wasTruncated: boolean;

  /** Chunk information for long documents */
  chunkInfo?: {
    chunkIndex: number;
    totalChunks: number;
    startChar: number;
    endChar: number;
  };

  /** Timestamp */
  createdAt: Date;
}

/**
 * Embedding generation options
 */
export interface EmbeddingOptions {
  /** Embedding model to use */
  model?: 'text-embedding-ada-002' | 'text-embedding-3-small' | 'text-embedding-3-large';

  /** Maximum tokens per chunk */
  maxTokensPerChunk?: number;

  /** Whether to average multiple chunk embeddings */
  aggregateChunks?: boolean;

  /** Custom dimensions (only for text-embedding-3-* models) */
  dimensions?: number;
}

/**
 * Raw Textract block for internal processing
 */
export interface RawTextractBlock {
  Id?: string;
  BlockType?: string;
  Text?: string;
  Confidence?: number;
  Geometry?: {
    BoundingBox?: {
      Width?: number;
      Height?: number;
      Left?: number;
      Top?: number;
    };
    Polygon?: Array<{
      X?: number;
      Y?: number;
    }>;
  };
  Relationships?: Array<{
    Type?: string;
    Ids?: string[];
  }>;
  EntityTypes?: string[];
  RowIndex?: number;
  ColumnIndex?: number;
  RowSpan?: number;
  ColumnSpan?: number;
  Page?: number;
}

/**
 * Supported file types for OCR
 */
export const SUPPORTED_OCR_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
] as const;

export type SupportedOcrMimeType = (typeof SUPPORTED_OCR_MIME_TYPES)[number];

/**
 * Check if a mime type is supported for OCR
 */
export function isSupportedOcrMimeType(mimeType: string): mimeType is SupportedOcrMimeType {
  return SUPPORTED_OCR_MIME_TYPES.includes(mimeType as SupportedOcrMimeType);
}
