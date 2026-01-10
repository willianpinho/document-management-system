'use client';

import { useState, useCallback, forwardRef } from 'react';
import {
  Search,
  X,
  Sparkles,
  Sliders,
  FileText,
  Folder,
  Clock,
  ChevronDown,
  LayoutList,
  Loader2,
} from 'lucide-react';
import {
  Button,
  Input,
  Badge,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Label,
  Slider,
  Switch,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@dms/ui';
import { cn } from '@/lib/utils';
import type { SearchMode, UseSemanticSearchReturn } from '@/hooks/useSemanticSearch';
import type { SearchType, SortField, SortOrder } from '@/lib/api';

interface SemanticSearchBarProps {
  search: UseSemanticSearchReturn;
  placeholder?: string;
  showModeSelector?: boolean;
  showFilters?: boolean;
  className?: string;
}

const modeOptions: { value: SearchMode; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: 'hybrid',
    label: 'Hybrid',
    icon: <Sparkles className="h-4 w-4" />,
    description: 'Best of text + AI (recommended)',
  },
  {
    value: 'semantic',
    label: 'Semantic',
    icon: <Sparkles className="h-4 w-4" />,
    description: 'AI-powered conceptual search',
  },
  {
    value: 'text',
    label: 'Text',
    icon: <LayoutList className="h-4 w-4" />,
    description: 'Traditional keyword matching',
  },
];

const typeOptions: { value: SearchType; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All', icon: <Search className="h-4 w-4" /> },
  { value: 'documents', label: 'Documents', icon: <FileText className="h-4 w-4" /> },
  { value: 'folders', label: 'Folders', icon: <Folder className="h-4 w-4" /> },
];

const sortOptions: { value: SortField; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'name', label: 'Name' },
  { value: 'createdAt', label: 'Created' },
  { value: 'updatedAt', label: 'Updated' },
  { value: 'size', label: 'Size' },
];

export const SemanticSearchBar = forwardRef<HTMLInputElement, SemanticSearchBarProps>(
  function SemanticSearchBar(
    {
      search,
      placeholder = 'Search documents and folders...',
      showModeSelector = true,
      showFilters = true,
      className,
    },
    ref
  ) {
    const [showSuggestions, setShowSuggestions] = useState(false);

    const currentMode = modeOptions.find((m) => m.value === search.mode);
    const currentType = typeOptions.find((t) => t.value === search.type);

    const handleSuggestionClick = useCallback(
      (suggestion: string) => {
        search.setQuery(suggestion);
        setShowSuggestions(false);
      },
      [search]
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
          setShowSuggestions(false);
          search.clearSearch();
        } else if (e.key === 'Enter') {
          setShowSuggestions(false);
          search.performSearch();
        }
      },
      [search]
    );

    return (
      <div className={cn('w-full', className)}>
        <div className="relative flex items-center gap-2">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={ref || search.searchInputRef}
              type="text"
              placeholder={placeholder}
              value={search.query}
              onChange={(e) => search.setQuery(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onKeyDown={handleKeyDown}
              className="pl-10 pr-10"
            />
            {search.query && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={search.clearSearch}
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {/* Loading indicator */}
            {search.isLoading && (
              <div className="absolute right-10 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Suggestions dropdown */}
            {showSuggestions && search.suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover p-1 shadow-lg">
                {search.suggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-muted"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mode selector */}
          {showModeSelector && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  {currentMode?.icon}
                  <span className="hidden sm:inline">{currentMode?.label}</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Search Mode</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {modeOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => search.setMode(option.value)}
                    className={cn(
                      'flex flex-col items-start gap-1',
                      search.mode === option.value && 'bg-muted'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {option.icon}
                      <span className="font-medium">{option.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Type selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                {currentType?.icon}
                <span className="hidden sm:inline">{currentType?.label}</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {typeOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => search.setType(option.value)}
                  className={cn(search.type === option.value && 'bg-muted')}
                >
                  <div className="flex items-center gap-2">
                    {option.icon}
                    <span>{option.label}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Filters popover */}
          {showFilters && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Sliders className="h-4 w-4" />
                  <span className="hidden sm:inline">Options</span>
                  {search.activeFilterCount > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5">
                      {search.activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80">
                <div className="space-y-4">
                  <h4 className="font-medium">Search Options</h4>

                  {/* Sort */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Sort by</Label>
                    <div className="flex gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="flex-1 justify-between">
                            {sortOptions.find((o) => o.value === search.sortBy)?.label}
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {sortOptions.map((option) => (
                            <DropdownMenuItem
                              key={option.value}
                              onClick={() => search.setSortBy(option.value)}
                            >
                              {option.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          search.setSortOrder(search.sortOrder === 'asc' ? 'desc' : 'asc')
                        }
                      >
                        {search.sortOrder === 'asc' ? '↑' : '↓'}
                      </Button>
                    </div>
                  </div>

                  {/* Semantic options */}
                  {(search.mode === 'semantic' || search.mode === 'hybrid') && (
                    <>
                      <div className="h-px bg-border" />

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">AI Reranking</Label>
                          <Switch
                            checked={search.enableReranking}
                            onCheckedChange={search.setEnableReranking}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Similarity Threshold</Label>
                            <span className="text-xs text-muted-foreground">
                              {(search.threshold * 100).toFixed(0)}%
                            </span>
                          </div>
                          <Slider
                            value={[search.threshold]}
                            onValueChange={([v]) => v !== undefined && search.setThreshold(v)}
                            min={0.1}
                            max={0.99}
                            step={0.05}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Hybrid weights */}
                  {search.mode === 'hybrid' && (
                    <>
                      <div className="h-px bg-border" />

                      <div className="space-y-3">
                        <Label className="text-xs">Search Balance</Label>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span>Text: {(search.textWeight * 100).toFixed(0)}%</span>
                            <span>Semantic: {(search.semanticWeight * 100).toFixed(0)}%</span>
                          </div>
                          <Slider
                            value={[search.textWeight]}
                            onValueChange={([v]) => {
                              if (v !== undefined) {
                                search.setTextWeight(v);
                                search.setSemanticWeight(1 - v);
                              }
                            }}
                            min={0}
                            max={1}
                            step={0.1}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Results per page */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Results per page</Label>
                    <div className="flex gap-2">
                      {[10, 20, 50, 100].map((n) => (
                        <Button
                          key={n}
                          variant={search.limit === n ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => search.setLimit(n)}
                        >
                          {n}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Search timing info */}
        {search.timing && search.hasResults && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              Found {search.total} results in {search.timing.totalMs}ms
            </span>
            {search.searchType && (
              <Badge variant="outline" className="text-[10px]">
                {search.searchType}
              </Badge>
            )}
          </div>
        )}
      </div>
    );
  }
);
