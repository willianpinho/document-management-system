import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';

import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationGuard } from '@/common/guards/organization.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '@/common/decorators/current-user.decorator';
import {
  SearchQueryDto,
  SemanticSearchDto,
  HybridSearchDto,
  SuggestQueryDto,
  SearchResponseDto,
  SuggestResponseDto,
  SearchType,
  SortField,
  SortOrder,
} from './dto/search.dto';

@ApiTags('search')
@Controller('search')
@UseGuards(JwtAuthGuard, OrganizationGuard)
@ApiBearerAuth('JWT-auth')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  // ===========================================================================
  // FULL-TEXT SEARCH
  // ===========================================================================

  @Get()
  @ApiOperation({
    summary: 'Full-text search',
    description: `
Search documents and folders using text-based matching.

Searches against:
- Document names
- Extracted text content (from OCR)
- Document metadata

Supports pagination, filtering, and sorting.
    `,
  })
  @ApiQuery({
    name: 'q',
    description: 'Search query string',
    required: true,
    example: 'quarterly report',
  })
  @ApiQuery({
    name: 'type',
    enum: SearchType,
    required: false,
    description: 'Type of resources to search (all, documents, folders)',
  })
  @ApiQuery({
    name: 'page',
    type: Number,
    required: false,
    description: 'Page number (starts at 1)',
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
    description: 'Results per page (1-100)',
  })
  @ApiQuery({
    name: 'sortBy',
    enum: SortField,
    required: false,
    description: 'Field to sort by',
  })
  @ApiQuery({
    name: 'sortOrder',
    enum: SortOrder,
    required: false,
    description: 'Sort direction (asc or desc)',
  })
  @ApiResponse({
    status: 200,
    description: 'Search results with pagination metadata',
    type: SearchResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async search(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: SearchQueryDto,
  ) {
    return this.searchService.search({
      organizationId: user.organizationId!,
      query: query.q,
      type: query.type || SearchType.ALL,
      page: query.page || 1,
      limit: query.limit || 20,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });
  }

  // ===========================================================================
  // SEMANTIC SEARCH
  // ===========================================================================

  @Post('semantic')
  @ApiOperation({
    summary: 'Semantic search',
    description: `
AI-powered semantic search using document embeddings and pgvector.

Features:
- Natural language understanding
- Finds conceptually similar documents
- Returns similarity scores (0-1)
- Optional reranking for improved relevance

Requires documents to have embeddings generated (via the embedding processor).
Falls back to text search if embeddings are unavailable.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Semantic search results with similarity scores',
    type: SearchResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async semanticSearch(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: SemanticSearchDto,
  ) {
    return this.searchService.semanticSearch({
      organizationId: user.organizationId!,
      query: body.query,
      limit: body.limit || 10,
      threshold: body.threshold || 0.7,
      filters: body.filters,
      enableReranking: body.enableReranking || false,
    });
  }

  // ===========================================================================
  // HYBRID SEARCH
  // ===========================================================================

  @Post('hybrid')
  @ApiOperation({
    summary: 'Hybrid search',
    description: `
Combined text and semantic search using Reciprocal Rank Fusion (RRF).

Combines the strengths of both approaches:
- Text search: Exact keyword matching, good for specific terms
- Semantic search: Conceptual understanding, good for natural language

Features:
- Configurable weights for text vs semantic results
- RRF algorithm for score combination
- Optional reranking with GPT-4

Best for most search use cases where you want both precision and recall.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Hybrid search results with combined scores',
    type: SearchResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async hybridSearch(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: HybridSearchDto,
  ) {
    return this.searchService.hybridSearch({
      organizationId: user.organizationId!,
      query: body.query,
      limit: body.limit || 20,
      textWeight: body.textWeight || 0.3,
      semanticWeight: body.semanticWeight || 0.7,
      threshold: body.threshold || 0.5,
      filters: body.filters,
      enableReranking: body.enableReranking ?? true,
    });
  }

  // ===========================================================================
  // AUTOCOMPLETE SUGGESTIONS
  // ===========================================================================

  @Get('suggest')
  @ApiOperation({
    summary: 'Autocomplete suggestions',
    description: `
Get autocomplete suggestions as the user types.

Returns matching:
- Document names
- Folder names

Suggestions are ranked by match quality and recency.
Minimum query length: 2 characters.
    `,
  })
  @ApiQuery({
    name: 'q',
    description: 'Partial query for autocomplete',
    required: true,
    example: 'quart',
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
    description: 'Maximum number of suggestions (1-20)',
  })
  @ApiResponse({
    status: 200,
    description: 'Autocomplete suggestions',
    type: SuggestResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async suggest(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: SuggestQueryDto,
  ) {
    return this.searchService.getSuggestions(
      user.organizationId!,
      query.q,
      query.limit || 5,
    );
  }
}
