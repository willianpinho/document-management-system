import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PDFDocument, PDFName, PDFDict, PDFRef, rgb, degrees, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import sharp from 'sharp';

import {
  SplitType,
  WatermarkPosition,
  CompressionQuality,
  ImageFormat,
  type WatermarkOptionsDto,
  type CompressionOptionsDto,
  type PageRenderOptionsDto,
} from '../dto/pdf-options.dto';
import {
  type PdfMetadataDto,
  type PdfOutlineItemDto,
} from '../dto/pdf-result.dto';

/**
 * Result of a split operation (in-memory)
 */
export interface SplitOutputBuffer {
  buffer: Buffer;
  pageRange: string;
  pageCount: number;
  filename: string;
}

/**
 * Result of a merge operation (in-memory)
 */
export interface MergeOutputBuffer {
  buffer: Buffer;
  pageCount: number;
}

/**
 * Result of watermark operation (in-memory)
 */
export interface WatermarkOutputBuffer {
  buffer: Buffer;
  pagesWatermarked: number;
}

/**
 * Result of compression operation (in-memory)
 */
export interface CompressionOutputBuffer {
  buffer: Buffer;
  originalSize: number;
  compressedSize: number;
}

/**
 * Result of page render operation (in-memory)
 */
export interface PageRenderOutput {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
}

/**
 * PDF Service - Core PDF manipulation operations
 * Uses pdf-lib for PDF operations and sharp for image rendering
 */
@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  /**
   * Parse page range string into array of page numbers (0-indexed)
   * Supports: "1-3,5,7-10" -> [0,1,2,4,6,7,8,9]
   */
  parsePageRanges(rangeString: string, totalPages: number): number[] {
    const pages = new Set<number>();
    const ranges = rangeString.split(',').map((r) => r.trim());

    for (const range of ranges) {
      if (range.includes('-')) {
        const [startStr, endStr] = range.split('-').map((s) => s.trim());
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);

        if (isNaN(start) || isNaN(end)) {
          throw new BadRequestException(`Invalid page range: ${range}`);
        }

        if (start < 1 || end > totalPages || start > end) {
          throw new BadRequestException(
            `Page range ${range} is out of bounds (document has ${totalPages} pages)`,
          );
        }

        for (let i = start; i <= end; i++) {
          pages.add(i - 1); // Convert to 0-indexed
        }
      } else {
        const page = parseInt(range, 10);

        if (isNaN(page)) {
          throw new BadRequestException(`Invalid page number: ${range}`);
        }

        if (page < 1 || page > totalPages) {
          throw new BadRequestException(
            `Page ${page} is out of bounds (document has ${totalPages} pages)`,
          );
        }

        pages.add(page - 1); // Convert to 0-indexed
      }
    }

    return Array.from(pages).sort((a, b) => a - b);
  }

  /**
   * Split PDF by page ranges
   * @param buffer - PDF buffer
   * @param pageRanges - Array of page range strings (e.g., ["1-3", "5", "7-10"])
   * @returns Array of split PDF buffers
   */
  async splitByPages(
    buffer: Buffer,
    pageRanges: string[],
  ): Promise<SplitOutputBuffer[]> {
    this.logger.log(`Splitting PDF by page ranges: ${pageRanges.join(', ')}`);

    const sourcePdf = await PDFDocument.load(buffer);
    const totalPages = sourcePdf.getPageCount();
    const results: SplitOutputBuffer[] = [];

    for (let i = 0; i < pageRanges.length; i++) {
      const range = pageRanges[i];
      const pageIndices = this.parsePageRanges(range, totalPages);

      if (pageIndices.length === 0) {
        this.logger.warn(`Range "${range}" resulted in no pages, skipping`);
        continue;
      }

      const newPdf = await PDFDocument.create();
      const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices);

      for (const page of copiedPages) {
        newPdf.addPage(page);
      }

      const pdfBytes = await newPdf.save();
      const splitBuffer = Buffer.from(pdfBytes);

      results.push({
        buffer: splitBuffer,
        pageRange: range,
        pageCount: pageIndices.length,
        filename: `split_${i + 1}_pages_${range.replace(/,/g, '_')}.pdf`,
      });
    }

    this.logger.log(`Created ${results.length} split documents`);
    return results;
  }

  /**
   * Split PDF by bookmarks/outline
   * Each top-level bookmark creates a new document
   * @param buffer - PDF buffer
   * @returns Array of split PDF buffers based on bookmarks
   */
  async splitByBookmarks(buffer: Buffer): Promise<SplitOutputBuffer[]> {
    this.logger.log('Splitting PDF by bookmarks');

    const sourcePdf = await PDFDocument.load(buffer);
    const totalPages = sourcePdf.getPageCount();
    const outline = this.extractOutline(sourcePdf);

    if (outline.length === 0) {
      throw new BadRequestException('PDF has no bookmarks/outline to split by');
    }

    const results: SplitOutputBuffer[] = [];

    for (let i = 0; i < outline.length; i++) {
      const bookmark = outline[i];
      const startPage = bookmark.pageNumber ? bookmark.pageNumber - 1 : 0;
      const endPage =
        i < outline.length - 1 && outline[i + 1].pageNumber
          ? outline[i + 1].pageNumber! - 1 - 1
          : totalPages - 1;

      if (startPage > endPage || startPage >= totalPages) {
        continue;
      }

      const pageIndices: number[] = [];
      for (let p = startPage; p <= endPage; p++) {
        pageIndices.push(p);
      }

      const newPdf = await PDFDocument.create();
      const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices);

      for (const page of copiedPages) {
        newPdf.addPage(page);
      }

      // Set title from bookmark
      newPdf.setTitle(bookmark.title);

      const pdfBytes = await newPdf.save();
      const splitBuffer = Buffer.from(pdfBytes);

      // Sanitize filename
      const safeTitle = bookmark.title
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 50);

      results.push({
        buffer: splitBuffer,
        pageRange: `${startPage + 1}-${endPage + 1}`,
        pageCount: pageIndices.length,
        filename: `${safeTitle || `chapter_${i + 1}`}.pdf`,
      });
    }

    this.logger.log(`Created ${results.length} documents from bookmarks`);
    return results;
  }

  /**
   * Merge multiple PDFs into one
   * @param buffers - Array of PDF buffers to merge
   * @returns Merged PDF buffer
   */
  async merge(buffers: Buffer[]): Promise<MergeOutputBuffer> {
    this.logger.log(`Merging ${buffers.length} PDF documents`);

    if (buffers.length === 0) {
      throw new BadRequestException('No PDF buffers provided for merging');
    }

    if (buffers.length === 1) {
      const pdf = await PDFDocument.load(buffers[0]);
      return {
        buffer: Buffer.from(await pdf.save()),
        pageCount: pdf.getPageCount(),
      };
    }

    const mergedPdf = await PDFDocument.create();
    let totalPages = 0;

    for (let i = 0; i < buffers.length; i++) {
      try {
        const pdf = await PDFDocument.load(buffers[i]);
        const pageCount = pdf.getPageCount();
        const pageIndices = Array.from({ length: pageCount }, (_, j) => j);
        const copiedPages = await mergedPdf.copyPages(pdf, pageIndices);

        for (const page of copiedPages) {
          mergedPdf.addPage(page);
        }

        totalPages += pageCount;
        this.logger.debug(`Added ${pageCount} pages from document ${i + 1}`);
      } catch (error) {
        this.logger.error(`Failed to process document ${i + 1}:`, error);
        throw new BadRequestException(
          `Failed to process PDF document ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    const mergedBytes = await mergedPdf.save();
    const mergedBuffer = Buffer.from(mergedBytes);

    this.logger.log(`Merged PDF created with ${totalPages} pages`);
    return {
      buffer: mergedBuffer,
      pageCount: totalPages,
    };
  }

  /**
   * Extract specific pages from a PDF
   * @param buffer - PDF buffer
   * @param pages - Array of page numbers (1-indexed)
   * @returns New PDF with only the specified pages
   */
  async extractPages(buffer: Buffer, pages: number[]): Promise<Buffer> {
    this.logger.log(`Extracting pages: ${pages.join(', ')}`);

    const sourcePdf = await PDFDocument.load(buffer);
    const totalPages = sourcePdf.getPageCount();

    // Validate and convert to 0-indexed
    const pageIndices: number[] = [];
    for (const page of pages) {
      if (page < 1 || page > totalPages) {
        throw new BadRequestException(
          `Page ${page} is out of bounds (document has ${totalPages} pages)`,
        );
      }
      pageIndices.push(page - 1);
    }

    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices);

    for (const page of copiedPages) {
      newPdf.addPage(page);
    }

    const pdfBytes = await newPdf.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Get PDF metadata
   * @param buffer - PDF buffer
   * @returns PDF metadata
   */
  async getMetadata(buffer: Buffer): Promise<PdfMetadataDto> {
    this.logger.log('Extracting PDF metadata');

    const pdf = await PDFDocument.load(buffer);
    const firstPage = pdf.getPage(0);
    const { width, height } = firstPage.getSize();

    // Check for form fields
    const form = pdf.getForm();
    const hasFormFields = form.getFields().length > 0;

    // Check encryption status
    const isEncrypted = false; // pdf-lib doesn't support encrypted PDFs directly

    // Extract outline
    const outline = this.extractOutline(pdf);

    // Parse dates
    const creationDate = pdf.getCreationDate();
    const modificationDate = pdf.getModificationDate();

    return {
      pageCount: pdf.getPageCount(),
      title: pdf.getTitle(),
      author: pdf.getAuthor(),
      subject: pdf.getSubject(),
      keywords: pdf.getKeywords(),
      creator: pdf.getCreator(),
      producer: pdf.getProducer(),
      creationDate: creationDate,
      modificationDate: modificationDate,
      pdfVersion: '1.7', // pdf-lib typically produces 1.7
      isEncrypted,
      hasFormFields,
      isLinearized: false, // pdf-lib doesn't preserve linearization
      pageDimensions: {
        width,
        height,
        unit: 'points',
      },
      outline: outline.length > 0 ? outline : undefined,
    };
  }

  /**
   * Add watermark to PDF
   * @param buffer - PDF buffer
   * @param options - Watermark options
   * @returns Watermarked PDF buffer
   */
  async addWatermark(
    buffer: Buffer,
    options: WatermarkOptionsDto,
  ): Promise<WatermarkOutputBuffer> {
    this.logger.log(`Adding watermark: "${options.text}"`);

    const pdf = await PDFDocument.load(buffer);
    pdf.registerFontkit(fontkit);

    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    const pages = pdf.getPages();
    const totalPages = pages.length;

    const {
      text,
      position = WatermarkPosition.CENTER,
      opacity = 0.3,
      fontSize = 48,
      color = { r: 0.5, g: 0.5, b: 0.5 },
      rotation = -45,
      allPages = true,
      pages: specificPages,
    } = options;

    // Determine which pages to watermark
    let pagesToWatermark: number[];
    if (allPages) {
      pagesToWatermark = Array.from({ length: totalPages }, (_, i) => i);
    } else if (specificPages && specificPages.length > 0) {
      pagesToWatermark = specificPages
        .filter((p) => p >= 1 && p <= totalPages)
        .map((p) => p - 1);
    } else {
      pagesToWatermark = Array.from({ length: totalPages }, (_, i) => i);
    }

    for (const pageIndex of pagesToWatermark) {
      const page = pages[pageIndex];
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textHeight = fontSize;

      let x: number;
      let y: number;
      let rotationDegrees = 0;

      switch (position) {
        case WatermarkPosition.TOP_LEFT:
          x = 50;
          y = height - 50 - textHeight;
          break;
        case WatermarkPosition.TOP_RIGHT:
          x = width - textWidth - 50;
          y = height - 50 - textHeight;
          break;
        case WatermarkPosition.BOTTOM_LEFT:
          x = 50;
          y = 50;
          break;
        case WatermarkPosition.BOTTOM_RIGHT:
          x = width - textWidth - 50;
          y = 50;
          break;
        case WatermarkPosition.DIAGONAL:
          x = width / 2 - textWidth / 2;
          y = height / 2;
          rotationDegrees = rotation;
          break;
        case WatermarkPosition.CENTER:
        default:
          x = width / 2 - textWidth / 2;
          y = height / 2 - textHeight / 2;
          break;
      }

      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(color.r, color.g, color.b),
        opacity,
        rotate: degrees(rotationDegrees),
      });
    }

    const pdfBytes = await pdf.save();
    return {
      buffer: Buffer.from(pdfBytes),
      pagesWatermarked: pagesToWatermark.length,
    };
  }

  /**
   * Compress PDF by removing unused objects and optimizing
   * Note: pdf-lib has limited compression capabilities
   * For true compression, consider using external tools like Ghostscript
   * @param buffer - PDF buffer
   * @param options - Compression options
   * @returns Compressed PDF buffer
   */
  async compress(
    buffer: Buffer,
    options: CompressionOptionsDto,
  ): Promise<CompressionOutputBuffer> {
    this.logger.log(`Compressing PDF with quality: ${options.quality}`);

    const originalSize = buffer.length;
    const pdf = await PDFDocument.load(buffer);

    // Remove metadata if requested
    if (options.removeMetadata) {
      pdf.setTitle('');
      pdf.setAuthor('');
      pdf.setSubject('');
      pdf.setKeywords([]);
      pdf.setCreator('');
      pdf.setProducer('');
    }

    // pdf-lib automatically removes unused objects during save
    // For more aggressive compression, additional processing would be needed

    // Save with options based on quality
    const saveOptions: { useObjectStreams?: boolean } = {};

    switch (options.quality) {
      case CompressionQuality.LOW:
        // Maximum compression (may affect some features)
        saveOptions.useObjectStreams = true;
        break;
      case CompressionQuality.MEDIUM:
        saveOptions.useObjectStreams = true;
        break;
      case CompressionQuality.HIGH:
        // Minimal compression, preserve all features
        saveOptions.useObjectStreams = false;
        break;
    }

    const pdfBytes = await pdf.save(saveOptions);
    const compressedBuffer = Buffer.from(pdfBytes);
    const compressedSize = compressedBuffer.length;

    this.logger.log(
      `Compression: ${originalSize} -> ${compressedSize} bytes (${Math.round((1 - compressedSize / originalSize) * 100)}% reduction)`,
    );

    return {
      buffer: compressedBuffer,
      originalSize,
      compressedSize,
    };
  }

  /**
   * Render a PDF page to an image
   * Note: pdf-lib cannot render pages directly.
   * This implementation creates a placeholder thumbnail.
   * For production, consider using pdf2image, pdfjs-dist, or external services.
   * @param buffer - PDF buffer
   * @param pageNumber - Page number (1-indexed)
   * @param options - Render options
   * @returns Image buffer
   */
  async renderPageToImage(
    buffer: Buffer,
    pageNumber: number,
    options: PageRenderOptionsDto = {},
  ): Promise<PageRenderOutput> {
    this.logger.log(`Rendering page ${pageNumber} to image`);

    const {
      width = 800,
      height,
      format = ImageFormat.PNG,
      quality = 80,
    } = options;

    // Load PDF to get page dimensions
    const pdf = await PDFDocument.load(buffer);
    const totalPages = pdf.getPageCount();

    if (pageNumber < 1 || pageNumber > totalPages) {
      throw new BadRequestException(
        `Page ${pageNumber} is out of bounds (document has ${totalPages} pages)`,
      );
    }

    const page = pdf.getPage(pageNumber - 1);
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Calculate output dimensions maintaining aspect ratio
    const aspectRatio = pageHeight / pageWidth;
    const outputWidth = width;
    const outputHeight = height || Math.round(width * aspectRatio);

    // Create a placeholder image since pdf-lib cannot render pages
    // In production, use pdfjs-dist, pdf2image, or a rendering service
    const placeholderSvg = `
      <svg width="${outputWidth}" height="${outputHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f5f5f5"/>
        <rect x="5%" y="5%" width="90%" height="90%" fill="#ffffff" stroke="#e0e0e0" stroke-width="2"/>
        <text x="50%" y="45%" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#9e9e9e">
          Page ${pageNumber} of ${totalPages}
        </text>
        <text x="50%" y="55%" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#bdbdbd">
          ${Math.round(pageWidth)} x ${Math.round(pageHeight)} pts
        </text>
      </svg>
    `;

    let imageBuffer: Buffer;
    let outputFormat: string;

    const sharpInstance = sharp(Buffer.from(placeholderSvg));

    switch (format) {
      case ImageFormat.JPEG:
        imageBuffer = await sharpInstance.jpeg({ quality }).toBuffer();
        outputFormat = 'jpeg';
        break;
      case ImageFormat.WEBP:
        imageBuffer = await sharpInstance.webp({ quality }).toBuffer();
        outputFormat = 'webp';
        break;
      case ImageFormat.PNG:
      default:
        imageBuffer = await sharpInstance.png().toBuffer();
        outputFormat = 'png';
        break;
    }

    return {
      buffer: imageBuffer,
      width: outputWidth,
      height: outputHeight,
      format: outputFormat,
    };
  }

  /**
   * Extract outline/bookmarks from PDF
   * @param pdf - PDFDocument instance
   * @returns Array of outline items
   */
  private extractOutline(pdf: PDFDocument): PdfOutlineItemDto[] {
    const outline: PdfOutlineItemDto[] = [];

    try {
      const catalog = pdf.catalog;
      const outlinesRef = catalog.get(PDFName.of('Outlines'));

      if (!outlinesRef) {
        return outline;
      }

      const context = pdf.context;
      const outlinesDict = context.lookup(outlinesRef as PDFRef);

      if (!(outlinesDict instanceof PDFDict)) {
        return outline;
      }

      const firstRef = outlinesDict.get(PDFName.of('First'));
      if (!firstRef) {
        return outline;
      }

      this.extractOutlineItems(pdf, firstRef as PDFRef, outline);
    } catch (error) {
      this.logger.warn('Failed to extract PDF outline:', error);
    }

    return outline;
  }

  /**
   * Recursively extract outline items
   */
  private extractOutlineItems(
    pdf: PDFDocument,
    ref: PDFRef,
    items: PdfOutlineItemDto[],
  ): void {
    const context = pdf.context;
    let currentRef: PDFRef | undefined = ref;

    while (currentRef) {
      const itemDict = context.lookup(currentRef);

      if (!(itemDict instanceof PDFDict)) {
        break;
      }

      const title = itemDict.get(PDFName.of('Title'));
      const titleStr = title ? String(title) : 'Untitled';

      // Clean up title string (remove PDF string markers)
      const cleanTitle = titleStr.replace(/^\(|\)$/g, '').replace(/\\(.)/g, '$1');

      const item: PdfOutlineItemDto = {
        title: cleanTitle,
      };

      // Try to get destination page
      const dest = itemDict.get(PDFName.of('Dest'));
      if (dest) {
        // Destination handling is complex, simplified here
        // In full implementation, resolve destination to page number
        item.pageNumber = undefined;
      }

      // Check for children
      const firstChildRef = itemDict.get(PDFName.of('First'));
      if (firstChildRef instanceof PDFRef) {
        item.children = [];
        this.extractOutlineItems(pdf, firstChildRef, item.children);
      }

      items.push(item);

      // Move to next sibling
      const nextRef = itemDict.get(PDFName.of('Next'));
      currentRef = nextRef instanceof PDFRef ? nextRef : undefined;
    }
  }

  /**
   * Split PDF every N pages
   * @param buffer - PDF buffer
   * @param everyNPages - Split every N pages
   * @returns Array of split PDF buffers
   */
  async splitEveryNPages(
    buffer: Buffer,
    everyNPages: number,
  ): Promise<SplitOutputBuffer[]> {
    this.logger.log(`Splitting PDF every ${everyNPages} pages`);

    if (everyNPages < 1) {
      throw new BadRequestException('everyNPages must be at least 1');
    }

    const sourcePdf = await PDFDocument.load(buffer);
    const totalPages = sourcePdf.getPageCount();
    const results: SplitOutputBuffer[] = [];

    for (let startPage = 0; startPage < totalPages; startPage += everyNPages) {
      const endPage = Math.min(startPage + everyNPages - 1, totalPages - 1);
      const pageIndices: number[] = [];

      for (let p = startPage; p <= endPage; p++) {
        pageIndices.push(p);
      }

      const newPdf = await PDFDocument.create();
      const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices);

      for (const page of copiedPages) {
        newPdf.addPage(page);
      }

      const pdfBytes = await newPdf.save();
      const splitBuffer = Buffer.from(pdfBytes);

      results.push({
        buffer: splitBuffer,
        pageRange: `${startPage + 1}-${endPage + 1}`,
        pageCount: pageIndices.length,
        filename: `part_${Math.floor(startPage / everyNPages) + 1}.pdf`,
      });
    }

    this.logger.log(`Created ${results.length} split documents`);
    return results;
  }

  /**
   * Validate that a buffer is a valid PDF
   * @param buffer - Buffer to validate
   * @returns true if valid PDF
   */
  async isValidPdf(buffer: Buffer): Promise<boolean> {
    try {
      await PDFDocument.load(buffer);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get page count from PDF buffer
   * @param buffer - PDF buffer
   * @returns Page count
   */
  async getPageCount(buffer: Buffer): Promise<number> {
    const pdf = await PDFDocument.load(buffer);
    return pdf.getPageCount();
  }
}
