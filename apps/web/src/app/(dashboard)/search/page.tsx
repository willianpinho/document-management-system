'use client';

import { Suspense, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  FileText,
  Folder,
  Filter,
  X,
  Wand2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Input,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@dms/ui';
import { useSearch, useSemanticSearch, type SearchResult } from '@/hooks/useSearch';
import { formatRelativeTime, cn } from '@/lib/utils';

const fileTypeFilters = [
  { value: '', label: 'All types' },
  { value: 'application/pdf', label: 'PDF' },
  { value: 'image/', label: 'Images' },
  { value: 'video/', label: 'Videos' },
  { value: 'audio/', label: 'Audio' },
  { value: 'application/vnd.openxmlformats', label: 'Office Documents' },
  { value: 'text/', label: 'Text files' },
];

const dateFilters = [
  { value: '', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Past week' },
  { value: 'month', label: 'Past month' },
  { value: 'year', label: 'Past year' },
];

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [searchMode, setSearchMode] = useState<'standard' | 'semantic'>('standard');

  // Standard search
  const {
    query: standardQuery,
    filters,
    results: standardResults,
    isLoading: isStandardLoading,
    setQuery: setStandardQuery,
    setFilter,
    clearFilters,
  } = useSearch({ q: initialQuery });

  // Semantic search
  const {
    query: semanticQuery,
    results: semanticResults,
    isSearching: isSemanticLoading,
    search: runSemanticSearch,
    setQuery: setSemanticQuery,
    clearResults: clearSemanticResults,
  } = useSemanticSearch();

  const query = searchMode === 'standard' ? standardQuery : semanticQuery;
  const results = searchMode === 'standard' ? standardResults : semanticResults;
  const isLoading = searchMode === 'standard' ? isStandardLoading : isSemanticLoading;

  const handleQueryChange = useCallback(
    (value: string) => {
      if (searchMode === 'standard') {
        setStandardQuery(value);
      } else {
        setSemanticQuery(value);
      }
    },
    [searchMode, setStandardQuery, setSemanticQuery]
  );

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (searchMode === 'semantic' && semanticQuery.trim()) {
        runSemanticSearch(semanticQuery);
      }
      // Update URL for standard search
      if (searchMode === 'standard' && standardQuery.trim()) {
        router.push(`/search?q=${encodeURIComponent(standardQuery)}`);
      }
    },
    [searchMode, semanticQuery, standardQuery, runSemanticSearch, router]
  );

  const handleModeChange = useCallback(
    (mode: 'standard' | 'semantic') => {
      setSearchMode(mode);
      if (mode === 'semantic') {
        clearSemanticResults();
      }
    },
    [clearSemanticResults]
  );

  const handleResultClick = useCallback(
    (result: SearchResult) => {
      if (result.type === 'document') {
        router.push(`/documents/${result.id}`);
      } else {
        router.push(`/folders/${result.id}`);
      }
    },
    [router]
  );

  const activeFiltersCount = [filters.mimeType, filters.dateFrom].filter(Boolean).length;

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Search</h1>
        <p className="text-muted-foreground">
          Find documents and folders across your workspace
        </p>
      </div>

      {/* Search form */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch}>
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={
                    searchMode === 'semantic'
                      ? 'Ask a question about your documents...'
                      : 'Search by name, content, or tags...'
                  }
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  className="pl-10 pr-4 text-lg"
                />
              </div>
              <Button type="submit" size="lg" disabled={!query.trim()}>
                Search
              </Button>
            </div>

            {/* Search mode toggle and filters */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={searchMode === 'standard' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleModeChange('standard')}
                >
                  <Search className="mr-2 h-4 w-4" />
                  Standard
                </Button>
                <Button
                  type="button"
                  variant={searchMode === 'semantic' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleModeChange('semantic')}
                >
                  <Wand2 className="mr-2 h-4 w-4" />
                  AI Search
                </Button>
              </div>

              {searchMode === 'standard' && (
                <div className="flex items-center gap-2">
                  {/* File type filter */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Filter className="mr-2 h-4 w-4" />
                        File type
                        {filters.mimeType && (
                          <Badge variant="secondary" className="ml-2">
                            1
                          </Badge>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuLabel>Filter by type</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {fileTypeFilters.map((filter) => (
                        <DropdownMenuItem
                          key={filter.value}
                          onClick={() => setFilter('mimeType', filter.value || undefined)}
                        >
                          {filter.label}
                          {filters.mimeType === filter.value && (
                            <span className="ml-auto text-primary">Selected</span>
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Date filter */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Clock className="mr-2 h-4 w-4" />
                        Date
                        {filters.dateFrom && (
                          <Badge variant="secondary" className="ml-2">
                            1
                          </Badge>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuLabel>Filter by date</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {dateFilters.map((filter) => (
                        <DropdownMenuItem
                          key={filter.value}
                          onClick={() => {
                            // Calculate date based on filter
                            let dateFrom: string | undefined;
                            if (filter.value) {
                              const now = new Date();
                              switch (filter.value) {
                                case 'today':
                                  dateFrom = now.toISOString().split('T')[0];
                                  break;
                                case 'week':
                                  now.setDate(now.getDate() - 7);
                                  dateFrom = now.toISOString().split('T')[0];
                                  break;
                                case 'month':
                                  now.setMonth(now.getMonth() - 1);
                                  dateFrom = now.toISOString().split('T')[0];
                                  break;
                                case 'year':
                                  now.setFullYear(now.getFullYear() - 1);
                                  dateFrom = now.toISOString().split('T')[0];
                                  break;
                              }
                            }
                            setFilter('dateFrom', dateFrom);
                          }}
                        >
                          {filter.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {activeFiltersCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="mr-2 h-4 w-4" />
                      Clear filters
                    </Button>
                  )}
                </div>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Search tips for semantic search */}
      {searchMode === 'semantic' && !query && !results.length && (
        <Card className="mb-6">
          <CardContent className="py-8">
            <div className="mx-auto max-w-lg text-center">
              <Wand2 className="mx-auto h-12 w-12 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">AI-Powered Search</h3>
              <p className="mt-2 text-muted-foreground">
                Ask natural language questions about your documents. Try:
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {[
                  'Find invoices from last month',
                  'Documents about project budget',
                  'Contracts mentioning renewal',
                  'Reports with financial data',
                ].map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSemanticQuery(suggestion);
                      runSemanticSearch(suggestion);
                    }}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Searching...</span>
          </div>
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Found {results.length} result{results.length !== 1 ? 's' : ''}
          </p>

          <div className="space-y-2">
            {results.map((result) => (
              <Card
                key={`${result.type}-${result.id}`}
                className="cursor-pointer transition-all hover:shadow-md"
                onClick={() => handleResultClick(result)}
              >
                <CardContent className="flex items-start gap-4 py-4">
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                      result.type === 'document'
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-blue-100 text-blue-500'
                    )}
                  >
                    {result.type === 'document' ? (
                      <FileText className="h-5 w-5" />
                    ) : (
                      <Folder className="h-5 w-5" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-medium">{result.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {result.path}
                        </p>
                      </div>
                      {result.score && (
                        <Badge variant="outline">
                          {Math.round(result.score * 100)}% match
                        </Badge>
                      )}
                    </div>

                    {result.snippet && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                        {result.snippet}
                      </p>
                    )}

                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{formatRelativeTime(result.createdAt)}</span>
                      {result.mimeType && <span>{result.mimeType}</span>}
                    </div>
                  </div>

                  <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : query ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No results found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search terms or filters
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function SearchPageLoading() {
  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Search</h1>
        <p className="text-muted-foreground">
          Find documents and folders across your workspace
        </p>
      </div>
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="h-12 flex-1 animate-pulse rounded-md bg-muted" />
            <div className="h-12 w-24 animate-pulse rounded-md bg-muted" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageLoading />}>
      <SearchPageContent />
    </Suspense>
  );
}
