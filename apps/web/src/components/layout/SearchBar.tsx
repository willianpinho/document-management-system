'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  X,
  FileText,
  Folder,
  Clock,
  ArrowRight,
  Filter,
  Loader2,
} from 'lucide-react';
import {
  Button,
  Input,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@dms/ui';
import { useSearch, useSearchSuggestions, type SearchResult } from '@/hooks/useSearch';
import { formatRelativeTime, cn } from '@/lib/utils';

interface SearchBarProps {
  className?: string;
  onResultClick?: (result: SearchResult) => void;
}

export function SearchBar({ className, onResultClick }: SearchBarProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    query,
    filters,
    results,
    isLoading,
    setQuery,
    setFilter,
    clearFilters,
  } = useSearch();

  const { suggestions } = useSearchSuggestions();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (event.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleResultClick = (result: SearchResult) => {
    setIsOpen(false);
    if (onResultClick) {
      onResultClick(result);
    } else {
      if (result.type === 'document') {
        router.push(`/documents/${result.id}`);
      } else {
        router.push(`/folders/${result.id}`);
      }
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
      setIsOpen(false);
    }
  };

  const fileTypeOptions = [
    { value: '', label: 'All types' },
    { value: 'application/pdf', label: 'PDF' },
    { value: 'image/', label: 'Images' },
    { value: 'video/', label: 'Videos' },
    { value: 'audio/', label: 'Audio' },
    { value: 'application/vnd.openxmlformats', label: 'Office Documents' },
  ];

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <form onSubmit={handleSearch}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search documents... (Cmd+K)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsOpen(true)}
            className="w-full pl-10 pr-24"
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {query && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setQuery('');
                  clearFilters();
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
            <DropdownMenu open={showFilters} onOpenChange={setShowFilters}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                >
                  <Filter className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Filter by type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {fileTypeOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => setFilter('mimeType', option.value || undefined)}
                  >
                    {option.label}
                    {filters.mimeType === option.value && (
                      <span className="ml-auto text-primary">Selected</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </form>

      {/* Search dropdown */}
      {isOpen && (query || results.length > 0) && (
        <div className="absolute top-full z-50 mt-2 w-full rounded-lg border bg-popover shadow-lg">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : results.length > 0 ? (
            <div className="max-h-96 overflow-y-auto py-2">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-accent"
                  onClick={() => handleResultClick(result)}
                >
                  {result.type === 'document' ? (
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <Folder className="h-4 w-4 shrink-0 text-blue-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{result.name}</p>
                    {result.snippet && (
                      <p className="truncate text-xs text-muted-foreground">
                        {result.snippet}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {result.path} - {formatRelativeTime(result.createdAt)}
                    </p>
                  </div>
                  {result.score && (
                    <span className="text-xs text-muted-foreground">
                      {Math.round(result.score * 100)}%
                    </span>
                  )}
                </button>
              ))}

              {query && (
                <button
                  className="flex w-full items-center gap-2 border-t px-4 py-3 text-sm text-primary hover:bg-accent"
                  onClick={handleSearch}
                >
                  <Search className="h-4 w-4" />
                  Search for &quot;{query}&quot;
                  <ArrowRight className="ml-auto h-4 w-4" />
                </button>
              )}
            </div>
          ) : query ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No results found for &quot;{query}&quot;
              </p>
              <button
                className="mt-2 text-sm text-primary hover:underline"
                onClick={handleSearch}
              >
                Search all documents
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
