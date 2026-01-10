'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  searchApi,
  type SearchResponse,
  type SearchResult,
  type SearchType,
  type SortField,
  type SortOrder,
  type SearchFilters,
} from '@/lib/api';

export type SearchMode = 'text' | 'semantic' | 'hybrid';

export interface UseSemanticSearchOptions {
  initialQuery?: string;
  initialMode?: SearchMode;
  debounceMs?: number;
  enabled?: boolean;
}

export function useSemanticSearch({
  initialQuery = '',
  initialMode = 'hybrid',
  debounceMs = 300,
  enabled = true,
}: UseSemanticSearchOptions = {}) {
  // Search state
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<SearchMode>(initialMode);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sortBy, setSortBy] = useState<SortField>('relevance');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [type, setType] = useState<SearchType>('all');
  const [filters, setFilters] = useState<SearchFilters>({});

  // Semantic search options
  const [threshold, setThreshold] = useState(0.7);
  const [enableReranking, setEnableReranking] = useState(true);
  const [textWeight, setTextWeight] = useState(0.3);
  const [semanticWeight, setSemanticWeight] = useState(0.7);

  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(query, debounceMs);

  // Full-text search query
  const textSearchQuery = useQuery({
    queryKey: ['search', 'text', debouncedQuery, type, page, limit, sortBy, sortOrder],
    queryFn: async () => {
      const response = await searchApi.search({
        q: debouncedQuery,
        type,
        page,
        limit,
        sortBy,
        sortOrder,
      });
      return response.data as SearchResponse;
    },
    enabled: enabled && mode === 'text' && debouncedQuery.length >= 2,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Semantic search mutation
  const semanticSearchMutation = useMutation({
    mutationFn: async () => {
      const response = await searchApi.semantic({
        query: debouncedQuery,
        limit,
        threshold,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
        enableReranking,
      });
      return response.data as SearchResponse;
    },
  });

  // Hybrid search mutation
  const hybridSearchMutation = useMutation({
    mutationFn: async () => {
      const response = await searchApi.hybrid({
        query: debouncedQuery,
        limit,
        textWeight,
        semanticWeight,
        threshold,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
        enableReranking,
      });
      return response.data as SearchResponse;
    },
  });

  // Suggestions query
  const suggestionsQuery = useQuery({
    queryKey: ['search', 'suggestions', debouncedQuery],
    queryFn: async () => {
      const response = await searchApi.suggest(debouncedQuery, 8);
      return response.data?.suggestions || [];
    },
    enabled: enabled && debouncedQuery.length >= 2,
    staleTime: 10000,
  });

  // Trigger search when query changes
  useEffect(() => {
    if (!enabled || debouncedQuery.length < 2) return;

    if (mode === 'semantic') {
      semanticSearchMutation.mutate();
    } else if (mode === 'hybrid') {
      hybridSearchMutation.mutate();
    }
    // For 'text' mode, the query handles it automatically
  }, [debouncedQuery, mode, enabled, threshold, enableReranking, textWeight, semanticWeight, filters]);

  // Get current results based on mode
  const getCurrentResults = (): SearchResponse | undefined => {
    switch (mode) {
      case 'text':
        return textSearchQuery.data;
      case 'semantic':
        return semanticSearchMutation.data;
      case 'hybrid':
        return hybridSearchMutation.data;
    }
  };

  const results = getCurrentResults();

  const isLoading =
    (mode === 'text' && textSearchQuery.isLoading) ||
    (mode === 'semantic' && semanticSearchMutation.isPending) ||
    (mode === 'hybrid' && hybridSearchMutation.isPending);

  const error =
    (mode === 'text' && textSearchQuery.error) ||
    (mode === 'semantic' && semanticSearchMutation.error) ||
    (mode === 'hybrid' && hybridSearchMutation.error);

  // Helper to perform search
  const performSearch = useCallback(() => {
    if (query.length < 2) return;

    if (mode === 'semantic') {
      semanticSearchMutation.mutate();
    } else if (mode === 'hybrid') {
      hybridSearchMutation.mutate();
    }
  }, [query, mode, semanticSearchMutation, hybridSearchMutation]);

  // Clear search
  const clearSearch = useCallback(() => {
    setQuery('');
    setPage(1);
    setFilters({});
  }, []);

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<SearchFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setPage(1);
  }, []);

  // Clear specific filter
  const clearFilter = useCallback((key: keyof SearchFilters) => {
    setFilters((prev) => {
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  // Focus search input
  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  // Get active filter count
  const activeFilterCount = Object.keys(filters).filter(
    (key) => filters[key as keyof SearchFilters] !== undefined
  ).length;

  return {
    // Search state
    query,
    setQuery,
    mode,
    setMode,
    type,
    setType,

    // Results
    results: results?.results || [],
    total: results?.total || 0,
    hasMore: results?.hasMore || false,
    searchType: results?.searchType,
    timing: results?.timing,

    // Pagination
    page,
    setPage,
    limit,
    setLimit,

    // Sorting
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,

    // Filters
    filters,
    updateFilters,
    clearFilter,
    showFilters,
    setShowFilters,
    activeFilterCount,

    // Semantic options
    threshold,
    setThreshold,
    enableReranking,
    setEnableReranking,
    textWeight,
    setTextWeight,
    semanticWeight,
    setSemanticWeight,

    // Suggestions
    suggestions: suggestionsQuery.data || [],
    isLoadingSuggestions: suggestionsQuery.isLoading,

    // Status
    isLoading,
    error,
    hasQuery: query.length >= 2,
    hasResults: (results?.results || []).length > 0,

    // Actions
    performSearch,
    clearSearch,
    focusSearch,

    // Refs
    searchInputRef,
  };
}

// Debounce hook helper
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export type UseSemanticSearchReturn = ReturnType<typeof useSemanticSearch>;
