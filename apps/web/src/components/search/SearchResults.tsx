'use client';

import { useRouter } from 'next/navigation';
import {
  FileText,
  Folder,
  Clock,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  FileAudio,
  FileVideo,
  File,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Badge,
} from '@dms/ui';
import { cn } from '@/lib/utils';
import type { SearchResult } from '@/lib/api';
import type { UseSemanticSearchReturn } from '@/hooks/useSemanticSearch';

interface SearchResultsProps {
  search: UseSemanticSearchReturn;
  onResultClick?: (result: SearchResult) => void;
  showPagination?: boolean;
  className?: string;
}

function getMimeTypeIcon(mimeType?: string) {
  if (!mimeType) return <File className="h-5 w-5" />;

  if (mimeType.startsWith('image/')) return <FileImage className="h-5 w-5 text-purple-500" />;
  if (mimeType.startsWith('video/')) return <FileVideo className="h-5 w-5 text-red-500" />;
  if (mimeType.startsWith('audio/')) return <FileAudio className="h-5 w-5 text-orange-500" />;
  if (mimeType === 'application/pdf') return <FileText className="h-5 w-5 text-red-600" />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel'))
    return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
  if (mimeType.includes('zip') || mimeType.includes('archive'))
    return <FileArchive className="h-5 w-5 text-yellow-600" />;
  if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('text/'))
    return <FileCode className="h-5 w-5 text-blue-500" />;

  return <File className="h-5 w-5 text-gray-500" />;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

function highlightSnippet(snippet: string, highlights?: string[]): React.ReactNode {
  if (!highlights || highlights.length === 0) return snippet;

  // Simple highlight - wrap matching terms in <mark>
  let result = snippet;
  highlights.forEach((highlight) => {
    const regex = new RegExp(`(${highlight})`, 'gi');
    result = result.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-900 px-0.5 rounded">$1</mark>');
  });

  return <span dangerouslySetInnerHTML={{ __html: result }} />;
}

function SearchResultCard({
  result,
  onClick,
}: {
  result: SearchResult;
  onClick: () => void;
}) {
  const isFolder = result.type === 'folder';

  return (
    <Card
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={onClick}
    >
      <CardContent className="flex items-start gap-4 p-4">
        {/* Icon */}
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            isFolder ? 'bg-blue-100 dark:bg-blue-950' : 'bg-muted'
          )}
        >
          {isFolder ? (
            <Folder className="h-5 w-5 text-blue-600" />
          ) : (
            getMimeTypeIcon(result.mimeType)
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium truncate">{result.name}</h3>
            {result.similarityScore && result.similarityScore > 0.8 && (
              <Badge variant="secondary" className="gap-1 shrink-0">
                <Sparkles className="h-3 w-3" />
                {(result.similarityScore * 100).toFixed(0)}% match
              </Badge>
            )}
          </div>

          {result.snippet && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {highlightSnippet(result.snippet, result.highlights)}
            </p>
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="truncate">{result.path}</span>
            {result.sizeBytes && (
              <>
                <span>•</span>
                <span>{formatFileSize(result.sizeBytes)}</span>
              </>
            )}
            <span>•</span>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{formatDate(result.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Score indicator */}
        {result.score !== undefined && (
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium"
            style={{
              background: `conic-gradient(var(--primary) ${result.score * 100}%, var(--muted) 0)`,
            }}
            title={`Relevance: ${(result.score * 100).toFixed(0)}%`}
          >
            <div className="h-6 w-6 rounded-full bg-background flex items-center justify-center">
              {(result.score * 100).toFixed(0)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SearchResults({
  search,
  onResultClick,
  showPagination = true,
  className,
}: SearchResultsProps) {
  const router = useRouter();

  const handleResultClick = (result: SearchResult) => {
    if (onResultClick) {
      onResultClick(result);
    } else {
      // Default navigation
      if (result.type === 'folder') {
        router.push(`/folders/${result.id}`);
      } else {
        router.push(`/documents/${result.id}`);
      }
    }
  };

  // No query yet
  if (!search.hasQuery) {
    return (
      <div className={cn('text-center py-12 text-muted-foreground', className)}>
        <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">Start typing to search</p>
        <p className="text-sm mt-1">
          Use AI-powered semantic search to find documents by meaning, not just keywords
        </p>
      </div>
    );
  }

  // Loading
  if (search.isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-start gap-4 p-4">
              <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 rounded bg-muted animate-pulse" />
                <div className="h-3 w-full rounded bg-muted animate-pulse" />
                <div className="h-3 w-32 rounded bg-muted animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // No results
  if (!search.hasResults) {
    return (
      <div className={cn('text-center py-12 text-muted-foreground', className)}>
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No results found</p>
        <p className="text-sm mt-1">
          Try different keywords or adjust your search filters
        </p>
        {search.mode !== 'hybrid' && (
          <Button
            variant="link"
            className="mt-4"
            onClick={() => search.setMode('hybrid')}
          >
            Try hybrid search for better results
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Results list */}
      <div className="space-y-3">
        {search.results.map((result) => (
          <SearchResultCard
            key={result.id}
            result={result}
            onClick={() => handleResultClick(result)}
          />
        ))}
      </div>

      {/* Pagination */}
      {showPagination && search.total > search.limit && (
        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Showing {(search.page - 1) * search.limit + 1} -{' '}
            {Math.min(search.page * search.limit, search.total)} of {search.total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => search.setPage(search.page - 1)}
              disabled={search.page === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => search.setPage(search.page + 1)}
              disabled={!search.hasMore}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
