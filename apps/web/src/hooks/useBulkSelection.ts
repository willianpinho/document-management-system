'use client';

import { useState, useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bulkApi, type BulkOperationResult, type BulkDownloadResult } from '@/lib/api';

export type SelectableItem = {
  id: string;
  type: 'document' | 'folder';
  name: string;
};

export interface UseBulkSelectionOptions {
  onSuccess?: (result: BulkOperationResult | BulkDownloadResult) => void;
  onError?: (error: Error) => void;
}

export function useBulkSelection(options: UseBulkSelectionOptions = {}) {
  const { onSuccess, onError } = options;
  const queryClient = useQueryClient();

  const [selectedItems, setSelectedItems] = useState<Map<string, SelectableItem>>(new Map());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const selectedDocumentIds = useMemo(
    () => Array.from(selectedItems.values())
      .filter(item => item.type === 'document')
      .map(item => item.id),
    [selectedItems]
  );

  const selectedFolderIds = useMemo(
    () => Array.from(selectedItems.values())
      .filter(item => item.type === 'folder')
      .map(item => item.id),
    [selectedItems]
  );

  const selectedCount = selectedItems.size;
  const hasSelection = selectedCount > 0;

  const toggleItem = useCallback((item: SelectableItem) => {
    setSelectedItems(prev => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.set(item.id, item);
      }
      return next;
    });
  }, []);

  const selectItem = useCallback((item: SelectableItem) => {
    setSelectedItems(prev => {
      const next = new Map(prev);
      next.set(item.id, item);
      return next;
    });
  }, []);

  const deselectItem = useCallback((id: string) => {
    setSelectedItems(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((items: SelectableItem[]) => {
    setSelectedItems(new Map(items.map(item => [item.id, item])));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Map());
    setIsSelectionMode(false);
  }, []);

  const isSelected = useCallback((id: string) => selectedItems.has(id), [selectedItems]);

  const enterSelectionMode = useCallback(() => setIsSelectionMode(true), []);
  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    clearSelection();
  }, [clearSelection]);

  // Bulk delete mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ permanent = false }: { permanent?: boolean } = {}) => {
      const response = await bulkApi.delete(
        selectedDocumentIds,
        selectedFolderIds.length > 0 ? selectedFolderIds : undefined,
        permanent
      );
      return response.data!;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      clearSelection();
      onSuccess?.(result);
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });

  // Bulk move mutation
  const moveMutation = useMutation({
    mutationFn: async (targetFolderId: string | null) => {
      const response = await bulkApi.move(
        selectedDocumentIds,
        targetFolderId,
        selectedFolderIds.length > 0 ? selectedFolderIds : undefined
      );
      return response.data!;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      clearSelection();
      onSuccess?.(result);
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });

  // Bulk copy mutation
  const copyMutation = useMutation({
    mutationFn: async (targetFolderId: string | null) => {
      const response = await bulkApi.copy(selectedDocumentIds, targetFolderId);
      return response.data!;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      clearSelection();
      onSuccess?.(result);
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });

  // Bulk download mutation
  const downloadMutation = useMutation({
    mutationFn: async () => {
      const response = await bulkApi.download(
        selectedDocumentIds,
        selectedFolderIds.length > 0 ? selectedFolderIds : undefined
      );
      return response.data!;
    },
    onSuccess: (result) => {
      // Open download URL in new tab
      window.open(result.downloadUrl, '_blank');
      clearSelection();
      onSuccess?.(result);
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });

  return {
    // Selection state
    selectedItems: Array.from(selectedItems.values()),
    selectedDocumentIds,
    selectedFolderIds,
    selectedCount,
    hasSelection,
    isSelectionMode,

    // Selection actions
    toggleItem,
    selectItem,
    deselectItem,
    selectAll,
    clearSelection,
    isSelected,
    enterSelectionMode,
    exitSelectionMode,

    // Bulk operations
    bulkDelete: deleteMutation.mutate,
    bulkMove: moveMutation.mutate,
    bulkCopy: copyMutation.mutate,
    bulkDownload: downloadMutation.mutate,

    // Loading states
    isDeleting: deleteMutation.isPending,
    isMoving: moveMutation.isPending,
    isCopying: copyMutation.isPending,
    isDownloading: downloadMutation.isPending,
    isProcessing:
      deleteMutation.isPending ||
      moveMutation.isPending ||
      copyMutation.isPending ||
      downloadMutation.isPending,
  };
}
