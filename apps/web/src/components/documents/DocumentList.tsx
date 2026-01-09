'use client';

import { useState } from 'react';
import {
  LayoutGrid,
  List,
  ArrowUpDown,
  ChevronDown,
  FileText,
  Upload,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@dms/ui';
import { DocumentCard } from './DocumentCard';
import { DocumentListRow } from './DocumentListRow';
import type { DocumentListItem } from '@/hooks/useDocuments';

interface DocumentListProps {
  documents: DocumentListItem[];
  isLoading?: boolean;
  onDownload?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string) => void;
  onMove?: (id: string) => void;
  onCopy?: (id: string) => void;
  onPreview?: (id: string) => void;
  onUpload?: () => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
}

type ViewMode = 'grid' | 'list';

const sortOptions = [
  { value: 'createdAt', label: 'Date created' },
  { value: 'updatedAt', label: 'Date modified' },
  { value: 'name', label: 'Name' },
  { value: 'sizeBytes', label: 'Size' },
];

export function DocumentList({
  documents,
  isLoading,
  onDownload,
  onDelete,
  onRename,
  onMove,
  onCopy,
  onPreview,
  onUpload,
  sortBy = 'createdAt',
  sortOrder = 'desc',
  onSortChange,
}: DocumentListProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const currentSort = sortOptions.find((s) => s.value === sortBy) ?? sortOptions[0]!;

  const handleSortChange = (value: string) => {
    if (onSortChange) {
      const newOrder = value === sortBy && sortOrder === 'desc' ? 'asc' : 'desc';
      onSortChange(value, newOrder);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Loading documents...</span>
        </div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No documents yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload your first document to get started
          </p>
          {onUpload && (
            <Button className="mt-4" onClick={onUpload}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ArrowUpDown className="mr-2 h-4 w-4" />
                {currentSort.label}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {sortOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => handleSortChange(option.value)}
                >
                  {option.label}
                  {sortBy === option.value && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {sortOrder === 'asc' ? '(A-Z)' : '(Z-A)'}
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-1 rounded-md border p-1">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="sr-only">Grid view</span>
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
            <span className="sr-only">List view</span>
          </Button>
        </div>
      </div>

      {/* Documents */}
      {viewMode === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onDownload={onDownload}
              onDelete={onDelete}
              onRename={onRename}
              onMove={onMove}
              onCopy={onCopy}
              onPreview={onPreview}
            />
          ))}
        </div>
      ) : (
        <Card>
          <div className="divide-y">
            {documents.map((doc) => (
              <DocumentListRow
                key={doc.id}
                document={doc}
                onDownload={onDownload}
                onDelete={onDelete}
                onRename={onRename}
                onMove={onMove}
                onCopy={onCopy}
                onPreview={onPreview}
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
