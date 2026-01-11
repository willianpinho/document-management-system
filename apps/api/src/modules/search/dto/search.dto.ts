import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsNumber,
  IsArray,
  IsDateString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// =============================================================================
// ENUMS
// =============================================================================

export enum SearchType {
  ALL = 'all',
  DOCUMENTS = 'documents',
  FOLDERS = 'folders',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export enum SortField {
  RELEVANCE = 'relevance',
  NAME = 'name',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  SIZE = 'size',
}

// =============================================================================
// FILTER DTOs
// =============================================================================

export class DateRangeFilterDto {
  @ApiPropertyOptional({
    description: 'Start date (ISO 8601)',
    example: '2025-01-01T00:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({
    description: 'End date (ISO 8601)',
    example: '2025-12-31T23:59:59Z',
  })
  @IsDateString()
  @IsOptional()
  to?: string;
}

export class SearchFiltersDto {
  @ApiPropertyOptional({
    description: 'Filter by folder ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsOptional()
  folderId?: string;

  @ApiPropertyOptional({
    description: 'Include documents from subfolders',
    default: true,
  })
  @IsOptional()
  includeSubfolders?: boolean = true;

  @ApiPropertyOptional({
    description: 'Filter by MIME types',
    example: ['application/pdf', 'image/png'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  mimeTypes?: string[];

  @ApiPropertyOptional({
    description: 'Filter by document status',
    example: ['READY', 'PROCESSING'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  statuses?: string[];

  @ApiPropertyOptional({
    description: 'Filter by creation date range',
    type: DateRangeFilterDto,
  })
  @ValidateNested()
  @Type(() => DateRangeFilterDto)
  @IsOptional()
  createdAt?: DateRangeFilterDto;

  @ApiPropertyOptional({
    description: 'Filter by update date range',
    type: DateRangeFilterDto,
  })
  @ValidateNested()
  @Type(() => DateRangeFilterDto)
  @IsOptional()
  updatedAt?: DateRangeFilterDto;

  @ApiPropertyOptional({
    description: 'Filter by file size range (bytes)',
    example: { min: 0, max: 10485760 },
  })
  @IsOptional()
  sizeRange?: {
    min?: number;
    max?: number;
  };

  @ApiPropertyOptional({
    description: 'Filter by AI classification category',
    example: 'Invoice',
  })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({
    description: 'Filter by tags (from AI classification)',
    example: ['financial', 'quarterly'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Filter by creator user ID',
  })
  @IsUUID()
  @IsOptional()
  createdById?: string;
}

// =============================================================================
// SEARCH QUERY DTOs
// =============================================================================

export class SearchQueryDto {
  @ApiProperty({
    description: 'Search query string',
    example: 'quarterly report',
  })
  @IsString()
  q: string;

  @ApiPropertyOptional({
    description: 'Type of resources to search',
    enum: SearchType,
    default: SearchType.ALL,
  })
  @IsEnum(SearchType)
  @IsOptional()
  type?: SearchType = SearchType.ALL;

  @ApiPropertyOptional({
    description: 'Page number',
    default: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Results per page',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: SortField,
    default: SortField.RELEVANCE,
  })
  @IsEnum(SortField)
  @IsOptional()
  sortBy?: SortField = SortField.RELEVANCE;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: SortOrder,
    default: SortOrder.DESC,
  })
  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({
    description: 'Filter by MIME type (supports partial match like "image/" or "application/pdf")',
    example: 'application/pdf',
  })
  @IsString()
  @IsOptional()
  mimeType?: string;

  @ApiPropertyOptional({
    description: 'Filter by creation date (ISO 8601 date, returns documents created on or after this date)',
    example: '2025-01-01',
  })
  @IsString()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter by folder ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsOptional()
  folderId?: string;
}

export class SemanticSearchDto {
  @ApiProperty({
    description: 'Natural language search query',
    example: 'documents about quarterly financial reports from 2025',
  })
  @IsString()
  query: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results',
    default: 10,
    minimum: 1,
    maximum: 50,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Similarity threshold (0-1). Higher values return more relevant results.',
    default: 0.7,
    minimum: 0,
    maximum: 1,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  threshold?: number = 0.7;

  @ApiPropertyOptional({
    description: 'Search filters',
    type: SearchFiltersDto,
  })
  @ValidateNested()
  @Type(() => SearchFiltersDto)
  @IsOptional()
  filters?: SearchFiltersDto;

  @ApiPropertyOptional({
    description: 'Enable reranking with cross-encoder model',
    default: false,
  })
  @IsOptional()
  enableReranking?: boolean = false;
}

export class HybridSearchDto {
  @ApiProperty({
    description: 'Search query (used for both text and semantic search)',
    example: 'quarterly financial report Q4 2025',
  })
  @IsString()
  query: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Weight for text search results (0-1)',
    default: 0.3,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  textWeight?: number = 0.3;

  @ApiPropertyOptional({
    description: 'Weight for semantic search results (0-1)',
    default: 0.7,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  semanticWeight?: number = 0.7;

  @ApiPropertyOptional({
    description: 'Minimum similarity threshold for semantic results',
    default: 0.5,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  threshold?: number = 0.5;

  @ApiPropertyOptional({
    description: 'Search filters',
    type: SearchFiltersDto,
  })
  @ValidateNested()
  @Type(() => SearchFiltersDto)
  @IsOptional()
  filters?: SearchFiltersDto;

  @ApiPropertyOptional({
    description: 'Enable reranking with cross-encoder for final ordering',
    default: true,
  })
  @IsOptional()
  enableReranking?: boolean = true;
}

export class SuggestQueryDto {
  @ApiProperty({
    description: 'Partial query for autocomplete suggestions',
    example: 'quart',
  })
  @IsString()
  q: string;

  @ApiPropertyOptional({
    description: 'Maximum number of suggestions',
    default: 5,
    minimum: 1,
    maximum: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  @IsOptional()
  limit?: number = 5;
}

// =============================================================================
// RESPONSE DTOs
// =============================================================================

export class SearchResultItemDto {
  @ApiProperty({ description: 'Resource ID' })
  id: string;

  @ApiProperty({ description: 'Resource type', enum: ['document', 'folder'] })
  type?: 'document' | 'folder';

  @ApiProperty({ description: 'Resource name' })
  name: string;

  @ApiPropertyOptional({ description: 'Path in folder hierarchy' })
  path?: string;

  @ApiPropertyOptional({ description: 'Original file name' })
  originalName?: string | null;

  @ApiPropertyOptional({ description: 'MIME type' })
  mimeType?: string;

  @ApiPropertyOptional({ description: 'File size in bytes' })
  sizeBytes?: bigint;

  @ApiPropertyOptional({ description: 'Document status' })
  status?: string;

  @ApiPropertyOptional({ description: 'Processing status' })
  processingStatus?: string;

  @ApiPropertyOptional({ description: 'Relevance score (0-1)' })
  score?: number;

  @ApiPropertyOptional({ description: 'Text match score component' })
  textScore?: number;

  @ApiPropertyOptional({ description: 'Semantic similarity score component' })
  semanticScore?: number;

  @ApiPropertyOptional({ description: 'Reranking score' })
  rerankScore?: number;

  @ApiPropertyOptional({ description: 'Matching text snippet with highlights' })
  snippet?: string;

  @ApiPropertyOptional({ description: 'Parent folder information' })
  folder?: {
    id: string;
    name: string;
    path: string;
  };

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;
}

export class SearchMetaDto {
  @ApiProperty({ description: 'Original search query' })
  query: string;

  @ApiProperty({ description: 'Search algorithm used' })
  algorithm: 'text' | 'semantic' | 'hybrid';

  @ApiProperty({ description: 'Total number of results' })
  total: number;

  @ApiProperty({ description: 'Current page' })
  page: number;

  @ApiProperty({ description: 'Results per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;

  @ApiProperty({ description: 'Search execution time in milliseconds' })
  took: number;

  @ApiPropertyOptional({ description: 'Similarity threshold used (semantic/hybrid only)' })
  threshold?: number;

  @ApiPropertyOptional({ description: 'Whether reranking was applied' })
  reranked?: boolean;
}

export class SearchResponseDto {
  @ApiProperty({ description: 'Search results', type: [SearchResultItemDto] })
  data: SearchResultItemDto[];

  @ApiProperty({ description: 'Search metadata', type: SearchMetaDto })
  meta: SearchMetaDto;
}

export class SuggestionDto {
  @ApiProperty({ description: 'Suggested text' })
  text: string;

  @ApiProperty({ description: 'Suggestion type' })
  type: 'document' | 'folder' | 'recent' | 'popular';

  @ApiPropertyOptional({ description: 'Resource ID if applicable' })
  id?: string;

  @ApiPropertyOptional({ description: 'Match score' })
  score?: number;
}

export class SuggestResponseDto {
  @ApiProperty({ description: 'Autocomplete suggestions', type: [SuggestionDto] })
  suggestions: SuggestionDto[];

  @ApiProperty({ description: 'Original partial query' })
  query: string;
}
