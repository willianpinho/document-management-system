'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileText,
} from 'lucide-react';
import { Button, Progress, Card, CardContent } from '@dms/ui';
import { useUpload, type UploadProgress } from '@/hooks/useUpload';
import { formatBytes, cn } from '@/lib/utils';

interface DocumentUploadProps {
  folderId?: string;
  onComplete?: (documentIds: string[]) => void;
  className?: string;
  compact?: boolean;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'],
  'video/*': ['.mp4', '.webm', '.mov', '.avi'],
  'audio/*': ['.mp3', '.wav', '.ogg', '.m4a'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'text/*': ['.txt', '.md', '.csv', '.json'],
};

export function DocumentUpload({
  folderId,
  onComplete,
  className,
  compact = false,
}: DocumentUploadProps) {
  const { uploads, uploadFiles, removeUpload, clearCompleted, isUploading } =
    useUpload(folderId);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const results = await uploadFiles(acceptedFiles);
      const successfulIds = results.filter((id): id is string => id !== null);
      if (successfulIds.length > 0 && onComplete) {
        onComplete(successfulIds);
      }
    },
    [uploadFiles, onComplete]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      accept: ACCEPTED_FILE_TYPES,
      maxSize: MAX_FILE_SIZE,
      multiple: true,
    });

  const hasCompleted = uploads.some((u) => u.status === 'completed');

  if (compact) {
    return (
      <div className={className}>
        <div
          {...getRootProps()}
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed p-4 transition-colors',
            isDragActive && 'border-primary bg-primary/10',
            isDragReject && 'border-destructive bg-destructive/10',
            !isDragActive && !isDragReject && 'border-muted-foreground/25 hover:border-primary/50'
          )}
        >
          <input {...getInputProps()} />
          <Upload className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {isDragActive ? 'Drop files here' : 'Drop files or click to upload'}
          </span>
        </div>

        {uploads.length > 0 && (
          <div className="mt-3 space-y-2">
            {uploads.map((upload) => (
              <UploadProgressItem
                key={upload.id}
                upload={upload}
                onRemove={removeUpload}
                compact
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div
          {...getRootProps()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors',
            isDragActive && 'border-primary bg-primary/10',
            isDragReject && 'border-destructive bg-destructive/10',
            !isDragActive && !isDragReject && 'border-muted-foreground/25 hover:border-primary/50'
          )}
        >
          <input {...getInputProps()} />
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Upload className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-sm font-medium">
            {isDragActive
              ? 'Drop your files here'
              : 'Drag and drop your files here'}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            or click to browse (max {formatBytes(MAX_FILE_SIZE)} per file)
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-1">
            {['PDF', 'Images', 'Videos', 'Documents', 'Spreadsheets'].map(
              (type) => (
                <span
                  key={type}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {type}
                </span>
              )
            )}
          </div>
        </div>

        {uploads.length > 0 && (
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-medium">
                Uploads ({uploads.length})
              </h4>
              {hasCompleted && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearCompleted}
                  className="h-7 text-xs"
                >
                  Clear completed
                </Button>
              )}
            </div>
            <div className="space-y-3">
              {uploads.map((upload) => (
                <UploadProgressItem
                  key={upload.id}
                  upload={upload}
                  onRemove={removeUpload}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface UploadProgressItemProps {
  upload: UploadProgress;
  onRemove: (id: string) => void;
  compact?: boolean;
}

function UploadProgressItem({
  upload,
  onRemove,
  compact = false,
}: UploadProgressItemProps) {
  const StatusIcon = {
    pending: Loader2,
    uploading: Loader2,
    processing: Loader2,
    completed: CheckCircle,
    error: AlertCircle,
  }[upload.status];

  const statusColor = {
    pending: 'text-muted-foreground',
    uploading: 'text-primary',
    processing: 'text-primary',
    completed: 'text-green-500',
    error: 'text-destructive',
  }[upload.status];

  const isAnimating = ['pending', 'uploading', 'processing'].includes(
    upload.status
  );

  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2 text-sm">
        <StatusIcon
          className={cn('h-4 w-4 shrink-0', statusColor, isAnimating && 'animate-spin')}
        />
        <span className="min-w-0 flex-1 truncate text-xs">{upload.file.name}</span>
        {upload.status === 'error' ? (
          <span className="text-xs text-destructive">{upload.error}</span>
        ) : (
          <span className="text-xs text-muted-foreground">{upload.progress}%</span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{upload.file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(upload.file.size)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <StatusIcon
                className={cn(
                  'h-4 w-4',
                  statusColor,
                  isAnimating && 'animate-spin'
                )}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onRemove(upload.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {upload.status === 'error' ? (
            <p className="mt-2 text-xs text-destructive">{upload.error}</p>
          ) : (
            <div className="mt-2">
              <Progress value={upload.progress} className="h-1" />
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>
                  {upload.status === 'completed'
                    ? 'Completed'
                    : upload.status === 'processing'
                      ? 'Processing...'
                      : 'Uploading...'}
                </span>
                <span>{upload.progress}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
