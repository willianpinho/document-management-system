'use client';

import { Suspense, useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Folder, Upload, X } from 'lucide-react';
import { Button, Badge, Dialog, DialogContent, DialogHeader, DialogTitle } from '@dms/ui';
import { DocumentList } from '@/components/documents/DocumentList';
import { DocumentUpload } from '@/components/documents/DocumentUpload';
import { DocumentPreview } from '@/components/documents/DocumentPreview';
import { BulkActionsBar } from '@/components/documents/BulkActionsBar';
import { CreateFolderDialog } from '@/components/folders/CreateFolderDialog';
import {
  useDocuments,
  useDocument,
  useDeleteDocument,
  useDocumentDownloadUrl,
  type DocumentDetail,
} from '@/hooks/useDocuments';
import { useCreateFolder } from '@/hooks/useFolders';
import { useBulkSelection, type SelectableItem } from '@/hooks/useBulkSelection';
import { downloadFile } from '@/lib/utils';
import { documentsApi, ApiError } from '@/lib/api';

function DocumentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'
  );

  // Filters from URL
  const filters = {
    mimeType: searchParams.get('mimeType') || undefined,
    status: searchParams.get('status') || undefined,
    folderId: searchParams.get('folderId') || undefined,
  };

  const activeFiltersCount = Object.values(filters).filter(Boolean).length;

  // Queries
  const { data: documentsData, isLoading } = useDocuments({
    ...filters,
    sortBy,
    sortOrder,
  });

  const { data: previewDocument } = useDocument(previewDocumentId || '');
  const { data: downloadUrlData } = useDocumentDownloadUrl(previewDocumentId || '');

  // Mutations
  const deleteDocument = useDeleteDocument();
  const createFolder = useCreateFolder();

  // Bulk selection
  const {
    selectedItems,
    selectedCount,
    hasSelection,
    isSelectionMode,
    toggleItem,
    selectAll,
    clearSelection,
    isSelected,
    enterSelectionMode,
    bulkDelete,
    bulkMove,
    bulkCopy,
    bulkDownload,
    isDeleting,
    isMoving,
    isCopying,
    isDownloading,
    isProcessing,
  } = useBulkSelection({
    onSuccess: () => {
      // Bulk operation completed successfully
    },
    onError: (error) => {
      console.error('Bulk operation failed:', error);
    },
  });

  // Handlers
  const handleSortChange = useCallback(
    (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
      setSortBy(newSortBy);
      setSortOrder(newSortOrder);

      const params = new URLSearchParams(searchParams);
      params.set('sortBy', newSortBy);
      params.set('sortOrder', newSortOrder);
      router.push(`/documents?${params.toString()}`);
    },
    [searchParams, router]
  );

  const handleFilterChange = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams);
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`/documents?${params.toString()}`);
    },
    [searchParams, router]
  );

  const clearFilters = useCallback(() => {
    router.push('/documents');
  }, [router]);

  const handleDownload = useCallback(
    async (id: string) => {
      try {
        const response = await documentsApi.getDownloadUrl(id);
        if (response.data?.url) {
          const doc = documentsData?.data?.find((d) => d.id === id);
          downloadFile(response.data.url, doc?.name || 'download');
        }
      } catch (error) {
        const apiError = error as ApiError;
        console.error('Download failed:', apiError.message || 'Unknown error');
      }
    },
    [documentsData]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (window.confirm('Are you sure you want to delete this document?')) {
        await deleteDocument.mutateAsync(id);
      }
    },
    [deleteDocument]
  );

  const handleRename = useCallback(
    (id: string) => {
      router.push(`/documents/${id}?edit=true`);
    },
    [router]
  );

  const handleMove = useCallback(
    (id: string) => {
      router.push(`/documents/${id}?move=true`);
    },
    [router]
  );

  const handleCopy = useCallback(
    (id: string) => {
      router.push(`/documents/${id}?copy=true`);
    },
    [router]
  );

  const handlePreview = useCallback((id: string) => {
    setPreviewDocumentId(id);
  }, []);

  const handleCreateFolder = useCallback(async (name: string) => {
    await createFolder.mutateAsync({ name });
    setIsCreateFolderOpen(false);
  }, [createFolder]);

  const documents = documentsData?.data || [];

  // Convert documents to selectable format for bulk operations
  const selectableDocuments: SelectableItem[] = useMemo(
    () =>
      documents.map((doc) => ({
        id: doc.id,
        type: 'document' as const,
        name: doc.name,
      })),
    [documents]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Documents</h1>
            <p className="text-sm text-muted-foreground">
              Manage and organize your documents
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsCreateFolderOpen(true)}>
              <Folder className="mr-2 h-4 w-4" />
              New Folder
            </Button>
            <Button onClick={() => setIsUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>
          </div>
        </div>

        {/* Active filters */}
        {activeFiltersCount > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Filters:</span>
            {filters.mimeType && (
              <Badge variant="secondary" className="gap-1">
                Type: {filters.mimeType}
                <button
                  onClick={() => handleFilterChange('mimeType', undefined)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.status && (
              <Badge variant="secondary" className="gap-1">
                Status: {filters.status}
                <button
                  onClick={() => handleFilterChange('status', undefined)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear all
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <DocumentList
          documents={documents}
          isLoading={isLoading}
          onDownload={handleDownload}
          onDelete={handleDelete}
          onRename={handleRename}
          onMove={handleMove}
          onCopy={handleCopy}
          onPreview={handlePreview}
          onUpload={() => setIsUploadOpen(true)}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
        />
      </div>

      {/* Upload dialog */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Documents</DialogTitle>
          </DialogHeader>
          <DocumentUpload
            onComplete={(ids) => {
              if (ids.length > 0) {
                setIsUploadOpen(false);
              }
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Create folder dialog */}
      <CreateFolderDialog
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        onCreate={handleCreateFolder}
        isCreating={createFolder.isPending}
      />

      {/* Preview dialog */}
      <DocumentPreview
        document={previewDocument as DocumentDetail | null}
        previewUrl={downloadUrlData?.url || null}
        isOpen={!!previewDocumentId}
        onClose={() => setPreviewDocumentId(null)}
        onDownload={() => previewDocumentId && handleDownload(previewDocumentId)}
      />

      {/* Bulk actions bar */}
      <BulkActionsBar
        selectedItems={selectedItems}
        selectedCount={selectedCount}
        isProcessing={isProcessing}
        isDeleting={isDeleting}
        isMoving={isMoving}
        isCopying={isCopying}
        isDownloading={isDownloading}
        onDelete={(options) => bulkDelete(options ?? {})}
        onMove={bulkMove}
        onCopy={bulkCopy}
        onDownload={bulkDownload}
        onClearSelection={clearSelection}
      />
    </div>
  );
}

function DocumentsPageLoading() {
  return (
    <div className="flex h-full flex-col">
      {/* Header skeleton */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-40 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-10 w-28 animate-pulse rounded bg-muted" />
            <div className="h-10 w-24 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={<DocumentsPageLoading />}>
      <DocumentsPageContent />
    </Suspense>
  );
}
