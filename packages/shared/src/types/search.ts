/**
 * Search-related type definitions for the Document Management System.
 * @module @dms/shared/types/search
 */

import type { Document, DocumentCategory } from './document.js';
import type { Folder } from './folder.js';

/**
 * Search result types.
 */
export const SearchResultType = {
  DOCUMENT: 'document',
  FOLDER: 'folder',
} as const;

export type SearchResultType = (typeof SearchResultType)[keyof typeof SearchResultType];

/**
 * Search mode options.
 */
export const SearchMode = {
  /** Basic full-text search */
  FULLTEXT: 'fulltext',
  /** AI-powered semantic search */
  SEMANTIC: 'semantic',
  /** Combined fulltext and semantic */
  HYBRID: 'hybrid',
} as const;

export type SearchMode = (typeof SearchMode)[keyof typeof SearchMode];

/**
 * Search query interface for full-text search.
 */
export interface SearchQuery {
  /** Search query string */
  query: string;
  /** Search mode */
  mode?: SearchMode;
  /** Maximum number of results */
  limit?: number;
  /** Result offset for pagination */
  offset?: number;
  /** Search filters */
  filters?: SearchFilters;
  /** Fields to search in */
  searchFields?: SearchField[];
  /** Whether to highlight matches */
  highlight?: boolean;
  /** Whether to include facets */
  includeFacets?: boolean;
  /** Fields to facet on */
  facetFields?: string[];
}

/**
 * Fields that can be searched.
 */
export const SearchField = {
  NAME: 'name',
  CONTENT: 'content',
  TAGS: 'tags',
  DESCRIPTION: 'description',
  METADATA: 'metadata',
  OCR_TEXT: 'ocrText',
} as const;

export type SearchField = (typeof SearchField)[keyof typeof SearchField];

/**
 * Search filters for refining results.
 */
export interface SearchFilters {
  /** Filter by result type */
  type?: SearchResultType[];
  /** Filter by folder ID */
  folderId?: string;
  /** Include subfolders in search */
  includeSubfolders?: boolean;
  /** Filter by MIME types */
  mimeTypes?: string[];
  /** Filter by file extensions */
  extensions?: string[];
  /** Filter by document status */
  status?: string[];
  /** Filter by document category */
  categories?: DocumentCategory[];
  /** Filter by tags (AND logic) */
  tags?: string[];
  /** Filter by tags (OR logic) */
  tagsAny?: string[];
  /** Filter by creator user ID */
  createdBy?: string;
  /** Filter by creation date range */
  createdAt?: DateRange;
  /** Filter by update date range */
  updatedAt?: DateRange;
  /** Filter by file size range (bytes) */
  sizeBytes?: NumberRange;
  /** Exclude specific document IDs */
  excludeIds?: string[];
  /** Only include specific document IDs */
  includeIds?: string[];
}

/**
 * Date range filter.
 */
export interface DateRange {
  /** Start date (inclusive) */
  from?: Date | string;
  /** End date (inclusive) */
  to?: Date | string;
}

/**
 * Numeric range filter.
 */
export interface NumberRange {
  /** Minimum value (inclusive) */
  min?: number;
  /** Maximum value (inclusive) */
  max?: number;
}

/**
 * Individual search result item.
 */
export interface SearchResult {
  /** Result type */
  type: SearchResultType;
  /** Result ID */
  id: string;
  /** Relevance score (0-1) */
  score: number;
  /** Document data (if type is document) */
  document?: SearchDocumentResult;
  /** Folder data (if type is folder) */
  folder?: SearchFolderResult;
  /** Highlighted text snippets */
  highlights?: SearchHighlight[];
}

/**
 * Document-specific search result data.
 */
export interface SearchDocumentResult {
  /** Document ID */
  id: string;
  /** Document name */
  name: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  sizeBytes: bigint;
  /** Folder ID */
  folderId: string | null;
  /** Folder path */
  folderPath: string | null;
  /** Document status */
  status: string;
  /** Tags */
  tags: string[];
  /** Document category */
  category?: DocumentCategory;
  /** Creation date */
  createdAt: Date;
  /** Last update date */
  updatedAt: Date;
  /** Thumbnail URL (if available) */
  thumbnailUrl?: string;
}

/**
 * Folder-specific search result data.
 */
export interface SearchFolderResult {
  /** Folder ID */
  id: string;
  /** Folder name */
  name: string;
  /** Folder path */
  path: string;
  /** Parent folder ID */
  parentId: string | null;
  /** Number of documents in folder */
  documentCount: number;
  /** Creation date */
  createdAt: Date;
}

/**
 * Text highlight in search results.
 */
export interface SearchHighlight {
  /** Field that was matched */
  field: string;
  /** Highlighted text snippets */
  snippets: string[];
}

/**
 * Semantic search query interface.
 */
export interface SemanticSearchQuery {
  /** Natural language query */
  query: string;
  /** Maximum number of results */
  limit?: number;
  /** Minimum similarity threshold (0-1) */
  threshold?: number;
  /** Search filters */
  filters?: SearchFilters;
  /** Include similarity score in results */
  includeScore?: boolean;
  /** Rerank results using cross-encoder */
  rerank?: boolean;
}

/**
 * Semantic search result with similarity score.
 */
export interface SemanticSearchResult {
  /** Document */
  document: SearchDocumentResult;
  /** Cosine similarity score (0-1) */
  similarity: number;
  /** Reranked score (if reranking enabled) */
  rerankScore?: number;
  /** Matched text chunk */
  matchedChunk?: string;
}

/**
 * Complete search response.
 */
export interface SearchResponse {
  /** Search results */
  results: SearchResult[];
  /** Total number of matching results */
  total: number;
  /** Search facets */
  facets?: SearchFacets;
  /** Query execution time in milliseconds */
  took: number;
  /** Whether results were truncated */
  truncated: boolean;
  /** Suggested corrections for the query */
  suggestions?: string[];
}

/**
 * Semantic search response.
 */
export interface SemanticSearchResponse {
  /** Search results */
  results: SemanticSearchResult[];
  /** Total number of matching results */
  total: number;
  /** Query execution time in milliseconds */
  took: number;
  /** Embedding model used */
  model: string;
}

/**
 * Search facets for filtering UI.
 */
export interface SearchFacets {
  /** MIME type facets */
  mimeTypes?: FacetBucket[];
  /** Extension facets */
  extensions?: FacetBucket[];
  /** Tag facets */
  tags?: FacetBucket[];
  /** Category facets */
  categories?: FacetBucket[];
  /** Folder facets */
  folders?: FacetBucket[];
  /** Date range facets */
  dateRanges?: FacetBucket[];
  /** Size range facets */
  sizeRanges?: FacetBucket[];
}

/**
 * Facet bucket with count.
 */
export interface FacetBucket {
  /** Facet value */
  value: string;
  /** Number of documents with this value */
  count: number;
  /** Display label */
  label?: string;
}

/**
 * Autocomplete suggestion.
 */
export interface AutocompleteSuggestion {
  /** Suggested text */
  text: string;
  /** Suggestion type */
  type: 'document' | 'folder' | 'tag' | 'query';
  /** Related ID (for document/folder) */
  id?: string;
  /** Match score */
  score: number;
  /** Highlighted text */
  highlight?: string;
}

/**
 * Autocomplete response.
 */
export interface AutocompleteResponse {
  /** Suggestions */
  suggestions: AutocompleteSuggestion[];
  /** Query execution time */
  took: number;
}

/**
 * Recent search entry.
 */
export interface RecentSearch {
  /** Search query */
  query: string;
  /** When the search was performed */
  timestamp: Date;
  /** Number of results found */
  resultCount: number;
  /** Filters used */
  filters?: SearchFilters;
}

/**
 * Saved search configuration.
 */
export interface SavedSearch {
  /** Saved search ID */
  id: string;
  /** User ID */
  userId: string;
  /** Search name */
  name: string;
  /** Search query */
  query: string;
  /** Search mode */
  mode: SearchMode;
  /** Filters */
  filters?: SearchFilters;
  /** Sort configuration */
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  /** Creation date */
  createdAt: Date;
  /** Last used date */
  lastUsedAt: Date | null;
}

/**
 * Search analytics event.
 */
export interface SearchAnalyticsEvent {
  /** Event ID */
  id: string;
  /** User ID */
  userId: string;
  /** Organization ID */
  organizationId: string;
  /** Search query */
  query: string;
  /** Search mode */
  mode: SearchMode;
  /** Filters used */
  filters?: SearchFilters;
  /** Number of results */
  resultCount: number;
  /** Clicked result ID */
  clickedResultId?: string;
  /** Click position (1-indexed) */
  clickPosition?: number;
  /** Query execution time */
  took: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Search index statistics.
 */
export interface SearchIndexStats {
  /** Total documents indexed */
  totalDocuments: number;
  /** Total folders indexed */
  totalFolders: number;
  /** Index size in bytes */
  indexSizeBytes: bigint;
  /** Last index update time */
  lastUpdated: Date;
  /** Index health status */
  status: 'healthy' | 'degraded' | 'rebuilding';
  /** Documents pending indexing */
  pendingCount: number;
}
