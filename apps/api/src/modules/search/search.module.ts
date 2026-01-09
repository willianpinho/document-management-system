import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { EmbeddingService } from './embedding.service';

/**
 * Search Module
 *
 * Provides search capabilities for the Document Management System:
 * - Full-text search: Text-based matching on document names and content
 * - Semantic search: AI-powered search using document embeddings and pgvector
 * - Hybrid search: Combines text and semantic search using Reciprocal Rank Fusion
 * - Autocomplete: Suggestions as the user types
 *
 * The EmbeddingService in this module is optimized for search queries,
 * while the EmbeddingService in ProcessingModule handles document indexing.
 */
@Module({
  imports: [ConfigModule],
  controllers: [SearchController],
  providers: [
    SearchService,
    // Query-side EmbeddingService for generating search query embeddings
    EmbeddingService,
  ],
  exports: [SearchService, EmbeddingService],
})
export class SearchModule {}
