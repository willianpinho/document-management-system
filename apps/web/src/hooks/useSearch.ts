'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { searchApi, type SearchResult } from '@/lib/api';
import { debounce } from '@/lib/utils';

export interface SearchFilters {
  q?: string;
  mimeType?: string;
  dateFrom?: string;
  dateTo?: string;
  folderId?: string;
  status?: string;
}

export function useSearch(initialFilters?: SearchFilters) {
  const [filters, setFilters] = useState<SearchFilters>(initialFilters || {});
  const [debouncedQuery, setDebouncedQuery] = useState(filters.q || '');

  // Debounced query update
  const updateDebouncedQuery = useCallback(
    debounce((query: string) => {
      setDebouncedQuery(query);
    }, 300),
    []
  );

  const setQuery = useCallback(
    (query: string) => {
      setFilters((prev) => ({ ...prev, q: query }));
      updateDebouncedQuery(query);
    },
    [updateDebouncedQuery]
  );

  const setFilter = useCallback(
    <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const clearFilters = useCallback(() => {
    setFilters({});
    setDebouncedQuery('');
  }, []);

  const searchQuery = useQuery({
    queryKey: ['search', { ...filters, q: debouncedQuery }],
    queryFn: async () => {
      if (!debouncedQuery && !filters.mimeType && !filters.folderId) {
        return { data: [], meta: undefined };
      }

      const response = await searchApi.search({
        ...filters,
        q: debouncedQuery,
      });
      return response;
    },
    enabled: !!(debouncedQuery || filters.mimeType || filters.folderId),
    staleTime: 1000 * 30, // 30 seconds
  });

  return {
    query: filters.q || '',
    filters,
    results: searchQuery.data?.data || [],
    meta: searchQuery.data?.meta,
    isLoading: searchQuery.isLoading,
    isError: searchQuery.isError,
    error: searchQuery.error,
    setQuery,
    setFilter,
    clearFilters,
    refetch: searchQuery.refetch,
  };
}

export function useSemanticSearch() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const search = useCallback(async (searchQuery: string, limit = 10) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const response = await searchApi.semantic({
        query: searchQuery,
        limit,
      });
      setResults(response.data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Search failed'));
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setQuery('');
    setError(null);
  }, []);

  return {
    query,
    setQuery,
    results,
    isSearching,
    error,
    search,
    clearResults,
  };
}

export function useSearchSuggestions() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounced query update
  const updateDebouncedQuery = useCallback(
    debounce((q: string) => {
      setDebouncedQuery(q);
    }, 200),
    []
  );

  const handleQueryChange = useCallback(
    (q: string) => {
      setQuery(q);
      updateDebouncedQuery(q);
    },
    [updateDebouncedQuery]
  );

  const suggestionsQuery = useQuery({
    queryKey: ['search', 'suggestions', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        return [];
      }
      const response = await searchApi.suggest(debouncedQuery);
      return response.data;
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 1000 * 60, // 1 minute
  });

  return {
    query,
    setQuery: handleQueryChange,
    suggestions: suggestionsQuery.data || [],
    isLoading: suggestionsQuery.isLoading,
  };
}

// Type exports
export type { SearchResult };
