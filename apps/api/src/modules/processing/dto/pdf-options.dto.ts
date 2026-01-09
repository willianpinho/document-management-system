import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Split type options
 */
export enum SplitType {
  PAGES = 'pages',
  BOOKMARKS = 'bookmarks',
  EVERY_N_PAGES = 'every_n_pages',
}

/**
 * Watermark position options
 */
export enum WatermarkPosition {
  CENTER = 'center',
  TOP_LEFT = 'top-left',
  TOP_RIGHT = 'top-right',
  BOTTOM_LEFT = 'bottom-left',
  BOTTOM_RIGHT = 'bottom-right',
  DIAGONAL = 'diagonal',
}

/**
 * Compression quality options
 */
export enum CompressionQuality {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

/**
 * Image format options for page rendering
 */
export enum ImageFormat {
  PNG = 'png',
  JPEG = 'jpeg',
  WEBP = 'webp',
}

/**
 * Options for splitting a PDF
 */
export class SplitOptionsDto {
  @ApiProperty({
    enum: SplitType,
    description: 'Type of split operation',
    example: SplitType.PAGES,
  })
  @IsEnum(SplitType)
  type: SplitType;

  @ApiPropertyOptional({
    type: [String],
    description: 'Page ranges to extract (e.g., ["1-3", "5", "7-10"])',
    example: ['1-3', '5', '7-10'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ranges?: string[];

  @ApiPropertyOptional({
    type: Number,
    description: 'Split every N pages (for EVERY_N_PAGES type)',
    example: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  everyNPages?: number;

  @ApiPropertyOptional({
    type: String,
    description: 'Output filename prefix',
    example: 'split_document',
  })
  @IsOptional()
  @IsString()
  outputPrefix?: string;
}

/**
 * Options for merging PDFs
 */
export class MergeOptionsDto {
  @ApiProperty({
    type: [String],
    description: 'Array of document IDs to merge',
  })
  @IsArray()
  @IsString({ each: true })
  documentIds: string[];

  @ApiProperty({
    description: 'Name of the output merged document',
    example: 'merged-document.pdf',
  })
  @IsString()
  outputName: string;

  @ApiPropertyOptional({
    description: 'Folder ID to save the merged document',
  })
  @IsOptional()
  @IsString()
  folderId?: string;
}

/**
 * RGB color for watermark
 */
export class RgbColorDto {
  @ApiProperty({ minimum: 0, maximum: 1, example: 0.5 })
  @IsNumber()
  @Min(0)
  @Max(1)
  r: number;

  @ApiProperty({ minimum: 0, maximum: 1, example: 0.5 })
  @IsNumber()
  @Min(0)
  @Max(1)
  g: number;

  @ApiProperty({ minimum: 0, maximum: 1, example: 0.5 })
  @IsNumber()
  @Min(0)
  @Max(1)
  b: number;
}

/**
 * Options for adding a watermark to a PDF
 */
export class WatermarkOptionsDto {
  @ApiProperty({
    description: 'Watermark text',
    example: 'CONFIDENTIAL',
  })
  @IsString()
  text: string;

  @ApiPropertyOptional({
    enum: WatermarkPosition,
    description: 'Position of the watermark',
    default: WatermarkPosition.CENTER,
  })
  @IsOptional()
  @IsEnum(WatermarkPosition)
  position?: WatermarkPosition;

  @ApiPropertyOptional({
    description: 'Opacity of the watermark (0-1)',
    minimum: 0,
    maximum: 1,
    default: 0.3,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  opacity?: number;

  @ApiPropertyOptional({
    description: 'Font size in points',
    default: 48,
  })
  @IsOptional()
  @IsNumber()
  @Min(8)
  @Max(200)
  fontSize?: number;

  @ApiPropertyOptional({
    type: RgbColorDto,
    description: 'Color of the watermark (RGB values 0-1)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RgbColorDto)
  color?: RgbColorDto;

  @ApiPropertyOptional({
    description: 'Rotation angle in degrees (for diagonal watermark)',
    default: -45,
  })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  rotation?: number;

  @ApiPropertyOptional({
    description: 'Apply watermark to all pages',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  allPages?: boolean;

  @ApiPropertyOptional({
    type: [Number],
    description: 'Specific pages to watermark (1-indexed)',
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  pages?: number[];
}

/**
 * Options for compressing a PDF
 */
export class CompressionOptionsDto {
  @ApiProperty({
    enum: CompressionQuality,
    description: 'Compression quality level',
    default: CompressionQuality.MEDIUM,
  })
  @IsEnum(CompressionQuality)
  quality: CompressionQuality;

  @ApiPropertyOptional({
    description: 'Flatten form fields',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  flattenForms?: boolean;

  @ApiPropertyOptional({
    description: 'Remove metadata',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  removeMetadata?: boolean;

  @ApiPropertyOptional({
    description: 'Subsample images to reduce size',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  subsampleImages?: boolean;
}

/**
 * Options for rendering a PDF page to an image
 */
export class PageRenderOptionsDto {
  @ApiPropertyOptional({
    description: 'Output width in pixels',
    default: 800,
  })
  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(4000)
  width?: number;

  @ApiPropertyOptional({
    description: 'Output height in pixels (maintains aspect ratio if not set)',
  })
  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(4000)
  height?: number;

  @ApiPropertyOptional({
    enum: ImageFormat,
    description: 'Output image format',
    default: ImageFormat.PNG,
  })
  @IsOptional()
  @IsEnum(ImageFormat)
  format?: ImageFormat;

  @ApiPropertyOptional({
    description: 'Image quality (1-100, for JPEG/WEBP)',
    default: 80,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  quality?: number;

  @ApiPropertyOptional({
    description: 'DPI for rendering',
    default: 150,
  })
  @IsOptional()
  @IsNumber()
  @Min(72)
  @Max(600)
  dpi?: number;
}

/**
 * Options for extracting specific pages from a PDF
 */
export class ExtractPagesOptionsDto {
  @ApiProperty({
    type: [Number],
    description: 'Page numbers to extract (1-indexed)',
    example: [1, 3, 5, 7],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  pages: number[];

  @ApiPropertyOptional({
    description: 'Output filename',
    example: 'extracted-pages.pdf',
  })
  @IsOptional()
  @IsString()
  outputName?: string;
}

/**
 * Request DTO for splitting a document
 */
export class SplitDocumentRequestDto {
  @ApiProperty({ type: SplitOptionsDto })
  @ValidateNested()
  @Type(() => SplitOptionsDto)
  options: SplitOptionsDto;
}

/**
 * Request DTO for merging documents
 */
export class MergeDocumentsRequestDto {
  @ApiProperty({ type: MergeOptionsDto })
  @ValidateNested()
  @Type(() => MergeOptionsDto)
  options: MergeOptionsDto;
}

/**
 * Request DTO for adding watermark
 */
export class AddWatermarkRequestDto {
  @ApiProperty({ type: WatermarkOptionsDto })
  @ValidateNested()
  @Type(() => WatermarkOptionsDto)
  options: WatermarkOptionsDto;
}

/**
 * Request DTO for compressing a PDF
 */
export class CompressDocumentRequestDto {
  @ApiProperty({ type: CompressionOptionsDto })
  @ValidateNested()
  @Type(() => CompressionOptionsDto)
  options: CompressionOptionsDto;
}

/**
 * Request DTO for extracting pages
 */
export class ExtractPagesRequestDto {
  @ApiProperty({ type: ExtractPagesOptionsDto })
  @ValidateNested()
  @Type(() => ExtractPagesOptionsDto)
  options: ExtractPagesOptionsDto;
}

/**
 * Request DTO for rendering a page to image
 */
export class RenderPageRequestDto {
  @ApiProperty({
    description: 'Page number to render (1-indexed)',
    example: 1,
  })
  @IsNumber()
  @Min(1)
  page: number;

  @ApiPropertyOptional({ type: PageRenderOptionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PageRenderOptionsDto)
  options?: PageRenderOptionsDto;
}
