'use client';

import { useState } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  cn,
} from '@dms/ui';
import type { SelectableItem } from '@/hooks/useBulkSelection';

interface BulkActionsBarProps {
  selectedItems: SelectableItem[];
  selectedCount: number;
  isProcessing: boolean;
  isDeleting: boolean;
  isMoving: boolean;
  isCopying: boolean;
  isDownloading: boolean;
  onDelete: (options?: { permanent?: boolean }) => void;
  onMove: (targetFolderId: string | null) => void;
  onCopy: (targetFolderId: string | null) => void;
  onDownload: () => void;
  onClearSelection: () => void;
  className?: string;
}

export function BulkActionsBar({
  selectedItems,
  selectedCount,
  isProcessing,
  isDeleting,
  isMoving,
  isCopying,
  isDownloading,
  onDelete,
  onMove,
  onCopy,
  onDownload,
  onClearSelection,
  className,
}: BulkActionsBarProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [permanentDelete, setPermanentDelete] = useState(false);

  if (selectedCount === 0) return null;

  const hasDocuments = selectedItems.some((item) => item.type === 'document');
  const hasFolders = selectedItems.some((item) => item.type === 'folder');

  const handleDeleteClick = (permanent: boolean) => {
    setPermanentDelete(permanent);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    onDelete({ permanent: permanentDelete });
    setDeleteDialogOpen(false);
  };

  return (
    <>
      <div
        className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
          'bg-background border rounded-lg shadow-lg',
          'flex items-center gap-2 px-4 py-2',
          className
        )}
      >
        <span className="text-sm font-medium mr-2">
          {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
        </span>

        <div className="h-4 w-px bg-border" />

        <Button
          variant="ghost"
          size="sm"
          onClick={onDownload}
          disabled={isProcessing || !hasDocuments}
          title={!hasDocuments ? 'Select documents to download' : 'Download selected items'}
        >
          {isDownloading ? (
            <span className="animate-spin mr-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </span>
          ) : (
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          )}
          Download
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onMove(null)}
          disabled={isProcessing}
        >
          {isMoving ? (
            <span className="animate-spin mr-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </span>
          ) : (
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
              />
            </svg>
          )}
          Move
        </Button>

        {hasDocuments && !hasFolders && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCopy(null)}
            disabled={isProcessing}
          >
            {isCopying ? (
              <span className="animate-spin mr-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </span>
            ) : (
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            )}
            Copy
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={isProcessing}
            >
              {isDeleting ? (
                <span className="animate-spin mr-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </span>
              ) : (
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              )}
              Delete
              <svg
                className="w-3 h-3 ml-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleDeleteClick(false)}>
              Move to Trash
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => handleDeleteClick(true)}
            >
              Delete Permanently
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-4 w-px bg-border" />

        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </Button>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {permanentDelete ? 'Permanently Delete Items?' : 'Move to Trash?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {permanentDelete ? (
                <>
                  This will permanently delete {selectedCount} item
                  {selectedCount !== 1 ? 's' : ''}. This action cannot be undone.
                </>
              ) : (
                <>
                  Move {selectedCount} item{selectedCount !== 1 ? 's' : ''} to
                  trash? You can restore them later from the trash.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className={permanentDelete ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {permanentDelete ? 'Delete Permanently' : 'Move to Trash'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
