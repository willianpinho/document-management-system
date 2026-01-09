'use client';

import { useState } from 'react';
import {
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize,
  FileText,
  Image,
  Video,
  Music,
  File,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
} from '@dms/ui';
import type { DocumentDetail } from '@/hooks/useDocuments';
import { formatBytes, formatDateTime } from '@/lib/utils';

interface DocumentPreviewProps {
  document: DocumentDetail | null;
  previewUrl: string | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

export function DocumentPreview({
  document,
  previewUrl,
  isOpen,
  onClose,
  onDownload,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
}: DocumentPreviewProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  if (!document) return null;

  const isImage = document.mimeType.startsWith('image/');
  const isPdf = document.mimeType === 'application/pdf';
  const isVideo = document.mimeType.startsWith('video/');
  const isAudio = document.mimeType.startsWith('audio/');

  const handleZoomIn = () => setZoom((z) => Math.min(z + 25, 200));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 25, 50));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);
  const handleReset = () => {
    setZoom(100);
    setRotation(0);
  };

  const renderPreviewContent = () => {
    if (!previewUrl) {
      return (
        <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
          <File className="h-16 w-16" />
          <p className="mt-4">Preview not available</p>
          {onDownload && (
            <Button className="mt-4" onClick={onDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download to view
            </Button>
          )}
        </div>
      );
    }

    if (isImage) {
      return (
        <div className="flex h-full items-center justify-center overflow-auto">
          <img
            src={previewUrl}
            alt={document.name}
            style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              transition: 'transform 0.2s',
            }}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      );
    }

    if (isPdf) {
      return (
        <iframe
          src={`${previewUrl}#toolbar=0`}
          className="h-full w-full border-0"
          title={document.name}
        />
      );
    }

    if (isVideo) {
      return (
        <div className="flex h-full items-center justify-center">
          <video
            src={previewUrl}
            controls
            className="max-h-full max-w-full"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }

    if (isAudio) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-6">
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-muted">
            <Music className="h-16 w-16 text-muted-foreground" />
          </div>
          <audio src={previewUrl} controls className="w-full max-w-md">
            Your browser does not support the audio tag.
          </audio>
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
        <FileText className="h-16 w-16" />
        <p className="mt-4">Preview not available for this file type</p>
        {onDownload && (
          <Button className="mt-4" onClick={onDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download to view
          </Button>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-3">
            {isImage ? (
              <Image className="h-5 w-5 text-green-500" />
            ) : isVideo ? (
              <Video className="h-5 w-5 text-purple-500" />
            ) : isAudio ? (
              <Music className="h-5 w-5 text-pink-500" />
            ) : isPdf ? (
              <FileText className="h-5 w-5 text-red-500" />
            ) : (
              <File className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <DialogTitle className="text-sm font-medium">
                {document.name}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                {formatBytes(document.sizeBytes)} - {formatDateTime(document.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {(isImage || isVideo) && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleZoomOut}
                  disabled={zoom <= 50}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="min-w-[3rem] text-center text-xs text-muted-foreground">
                  {zoom}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleZoomIn}
                  disabled={zoom >= 200}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleRotate}
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleReset}
                >
                  <Maximize className="h-4 w-4" />
                </Button>
                <div className="mx-2 h-5 w-px bg-border" />
              </>
            )}

            {onDownload && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onDownload}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Preview content */}
        <div className="relative flex-1 bg-muted/50 overflow-hidden">
          {renderPreviewContent()}

          {/* Navigation */}
          {(hasPrevious || hasNext) && (
            <>
              {hasPrevious && onPrevious && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute left-4 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full shadow-lg"
                  onClick={onPrevious}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              )}
              {hasNext && onNext && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-4 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full shadow-lg"
                  onClick={onNext}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              )}
            </>
          )}
        </div>

        {/* Footer with metadata */}
        {document.metadata && (
          <div className="border-t px-4 py-3">
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              {document.metadata.pageCount && (
                <span>Pages: {document.metadata.pageCount}</span>
              )}
              {document.metadata.classification && (
                <span>
                  Type: {document.metadata.classification.category} (
                  {Math.round(document.metadata.classification.confidence * 100)}%
                  confidence)
                </span>
              )}
              {document.metadata.tags && document.metadata.tags.length > 0 && (
                <span>Tags: {document.metadata.tags.join(', ')}</span>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
