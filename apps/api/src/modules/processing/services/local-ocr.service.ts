/**
 * Local OCR Service
 *
 * Provides local text extraction fallback when AWS Textract is not available.
 * Uses pdf-parse for PDF text extraction. This is useful for development
 * environments where AWS credentials are not configured.
 *
 * Limitations vs Textract:
 * - No table detection
 * - No form field extraction
 * - No signature detection
 * - Text only (no geometry/bounding boxes)
 */

import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');
import {
  OcrResult,
  OcrTextBlock,
  isSupportedOcrMimeType,
} from '../dto/ocr-result.dto';

@Injectable()
export class LocalOcrService {
  private readonly logger = new Logger(LocalOcrService.name);

  /**
   * Extract text from a PDF buffer using local processing
   */
  async extractTextFromPdf(buffer: Buffer): Promise<OcrResult> {
    const startTime = Date.now();

    this.logger.log('Using local PDF text extraction (fallback mode)');

    try {
      const data = await pdfParse(buffer);

      const text = data.text || '';
      const pageCount = data.numpages || 1;
      const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;

      // Create basic text blocks from paragraphs
      const textBlocks: OcrTextBlock[] = text
        .split(/\n\n+/)
        .filter((p) => p.trim().length > 0)
        .map((paragraph, index) => ({
          id: `local-block-${index}`,
          blockType: 'LINE' as const,
          text: paragraph.trim(),
          confidence: 100, // Local extraction has no confidence score
          geometry: {
            boundingBox: { width: 0, height: 0, left: 0, top: 0 },
            polygon: [],
          },
          page: 1, // pdf-parse doesn't provide page info per paragraph
        }));

      const processingTimeMs = Date.now() - startTime;

      this.logger.log(
        `Local OCR completed: ${wordCount} words, ${pageCount} pages in ${processingTimeMs}ms`,
      );

      return {
        id: `local-ocr-${Date.now()}`,
        documentId: '',
        status: 'completed',
        text,
        textBlocks,
        tables: [], // Local processing doesn't detect tables
        formFields: [], // Local processing doesn't detect form fields
        signatures: [], // Local processing doesn't detect signatures
        pages: Array.from({ length: pageCount }, (_, i) => ({
          pageNumber: i + 1,
          width: 1,
          height: 1,
          textBlockCount: i === 0 ? textBlocks.length : 0,
          lineCount: text.split('\n').length,
          wordCount,
        })),
        pageCount,
        confidence: 100, // Local extraction has no confidence
        wordCount,
        characterCount: text.length,
        detectedLanguages: [],
        metadata: {
          processingTimeMs,
          textractApiVersion: 'local-fallback',
          featureTypes: ['TEXT'],
          rawBlockCount: textBlocks.length,
        },
        startedAt: new Date(),
        completedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Local OCR failed: ${error}`);
      throw new Error(
        `Local PDF text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Check if a document type is supported for local OCR
   * Currently only supports PDFs
   */
  isSupported(mimeType: string): boolean {
    // Local OCR only supports PDFs
    return mimeType === 'application/pdf';
  }

  /**
   * Check if document type is supported for OCR (any method)
   */
  isSupportedOcr(mimeType: string): boolean {
    return isSupportedOcrMimeType(mimeType);
  }
}
