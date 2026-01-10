'use client';

import { useCallback, useRef, useState } from 'react';
import { Button, Progress, cn } from '@dms/ui';
import {
  useResumableUpload,
  type UploadProgress,
  type UseResumableUploadOptions,
} from '@/hooks/useResumableUpload';
import type { CompleteUploadResult } from '@/lib/api';

interface ResumableUploaderProps {
  folderId?: string;
  metadata?: Record<string, unknown>;
  onComplete?: (result: CompleteUploadResult) => void;
  onError?: (error: Error) => void;
  className?: string;
  accept?: string;
  multiple?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTime(seconds: number | null): string {
  if (seconds === null || !isFinite(seconds)) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function ResumableUploader({
  folderId,
  metadata,
  onComplete,
  onError,
  className,
  accept = '*/*',
  multiple = false,
}: ResumableUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const uploadOptions: UseResumableUploadOptions = {
    onComplete,
    onError,
  };

  const {
    progress,
    startUpload,
    resumeUpload,
    pauseUpload,
    cancelUpload,
    reset,
    isUploading,
    isPaused,
    isCompleted,
    hasError,
  } = useResumableUpload(uploadOptions);

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      // For now, handle single file upload
      const file = files[0];
      if (file) {
        await startUpload(file, folderId, metadata);
      }
    },
    [folderId, metadata, startUpload]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFileSelect(e.target.files);
      // Reset input
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [handleFileSelect]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files);
      }
    },
    [handleFileSelect]
  );

  const handleBrowse = () => {
    inputRef.current?.click();
  };

  const renderIdleState = () => (
    <div
      className={cn(
        'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
        dragActive
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-muted-foreground/50',
        className
      )}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        className="hidden"
      />
      <div className="flex flex-col items-center gap-4">
        <div className="text-4xl">
          <svg
            className="w-12 h-12 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium">
            Drag and drop your file here, or{' '}
            <button
              type="button"
              onClick={handleBrowse}
              className="text-primary hover:underline"
            >
              browse
            </button>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Large files are automatically uploaded in chunks for reliability
          </p>
        </div>
      </div>
    </div>
  );

  const renderUploadingState = () => (
    <div className={cn('border rounded-lg p-4', className)}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 bg-muted rounded flex items-center justify-center">
          <svg
            className="w-5 h-5 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-sm font-medium truncate">{progress.fileName}</p>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isPaused ? (
                <Button size="sm" variant="outline" onClick={resumeUpload}>
                  Resume
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={pauseUpload}>
                  Pause
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={cancelUpload}>
                Cancel
              </Button>
            </div>
          </div>
          <Progress value={progress.progress} className="h-2" />
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>
              {formatBytes(progress.uploadedBytes)} /{' '}
              {formatBytes(progress.totalBytes)}
            </span>
            <span className="flex items-center gap-3">
              <span>{formatBytes(progress.uploadSpeed)}/s</span>
              <span>{formatTime(progress.remainingTime)} remaining</span>
            </span>
          </div>
          <div className="flex items-center gap-1 mt-2">
            {progress.chunks.map((chunk) => (
              <div
                key={chunk.chunkNumber}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  chunk.status === 'completed'
                    ? 'bg-primary'
                    : chunk.status === 'uploading'
                    ? 'bg-primary/50 animate-pulse'
                    : chunk.status === 'error'
                    ? 'bg-destructive'
                    : 'bg-muted'
                )}
                title={`Chunk ${chunk.chunkNumber + 1}: ${chunk.status}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderCompletedState = () => (
    <div className={cn('border rounded-lg p-4', className)}>
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0 w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
          <svg
            className="w-5 h-5 text-green-600 dark:text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{progress.fileName}</p>
          <p className="text-xs text-muted-foreground">
            Upload complete - {formatBytes(progress.totalBytes)}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={reset}>
          Upload Another
        </Button>
      </div>
    </div>
  );

  const renderErrorState = () => (
    <div className={cn('border border-destructive/50 rounded-lg p-4', className)}>
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0 w-10 h-10 bg-destructive/10 rounded-full flex items-center justify-center">
          <svg
            className="w-5 h-5 text-destructive"
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
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">Upload Failed</p>
          <p className="text-xs text-destructive">{progress.error}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={resumeUpload}>
            Retry
          </Button>
          <Button size="sm" variant="ghost" onClick={reset}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );

  if (progress.status === 'idle') {
    return renderIdleState();
  }

  if (
    progress.status === 'preparing' ||
    progress.status === 'uploading' ||
    progress.status === 'completing' ||
    progress.status === 'paused'
  ) {
    return renderUploadingState();
  }

  if (progress.status === 'completed') {
    return renderCompletedState();
  }

  if (progress.status === 'error' || progress.status === 'cancelled') {
    return renderErrorState();
  }

  return null;
}
