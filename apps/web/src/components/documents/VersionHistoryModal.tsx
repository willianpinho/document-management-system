'use client';

import { useState, useCallback } from 'react';
import {
  History,
  Download,
  RotateCcw,
  Clock,
  User,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Badge,
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@dms/ui';
import { formatBytes, formatDateTime, formatRelativeTime, cn } from '@/lib/utils';

export interface DocumentVersion {
  id: string;
  versionNumber: number;
  sizeBytes: number;
  checksum?: string;
  changeNote?: string;
  createdAt: string;
  createdBy?: {
    id: string;
    name?: string;
    email: string;
    avatarUrl?: string;
  };
}

interface VersionHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentName: string;
  currentVersionNumber: number;
  versions: DocumentVersion[];
  onDownloadVersion: (versionId: string) => Promise<void>;
  onRestoreVersion: (versionId: string) => Promise<void>;
  isLoading?: boolean;
}

export function VersionHistoryModal({
  open,
  onOpenChange,
  documentId,
  documentName,
  currentVersionNumber,
  versions,
  onDownloadVersion,
  onRestoreVersion,
  isLoading,
}: VersionHistoryModalProps) {
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());
  const [restoringVersion, setRestoringVersion] = useState<string | null>(null);
  const [downloadingVersion, setDownloadingVersion] = useState<string | null>(null);

  const toggleExpanded = useCallback((versionId: string) => {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(versionId)) {
        next.delete(versionId);
      } else {
        next.add(versionId);
      }
      return next;
    });
  }, []);

  const handleDownload = useCallback(
    async (versionId: string) => {
      setDownloadingVersion(versionId);
      try {
        await onDownloadVersion(versionId);
      } finally {
        setDownloadingVersion(null);
      }
    },
    [onDownloadVersion]
  );

  const handleRestore = useCallback(
    async (versionId: string) => {
      setRestoringVersion(versionId);
      try {
        await onRestoreVersion(versionId);
        onOpenChange(false);
      } finally {
        setRestoringVersion(null);
      }
    },
    [onRestoreVersion, onOpenChange]
  );

  // Sort versions by version number descending
  const sortedVersions = [...versions].sort(
    (a, b) => b.versionNumber - a.versionNumber
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </DialogTitle>
          <DialogDescription>
            View and manage versions of &quot;{documentName}&quot;
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <History className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">
                No previous versions available
              </p>
              <p className="text-xs text-muted-foreground">
                Versions are created when you upload a new file
              </p>
            </div>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {sortedVersions.map((version, index) => {
                const isExpanded = expandedVersions.has(version.id);
                const isCurrent = version.versionNumber === currentVersionNumber;
                const isLatest = index === 0;

                return (
                  <div
                    key={version.id}
                    className={cn(
                      'rounded-lg border p-3 transition-colors',
                      isCurrent && 'border-primary bg-primary/5',
                      !isCurrent && 'hover:bg-muted/50'
                    )}
                  >
                    {/* Version header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-full',
                            isCurrent
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              Version {version.versionNumber}
                            </span>
                            {isCurrent && (
                              <Badge variant="default" className="text-xs">
                                Current
                              </Badge>
                            )}
                            {isLatest && !isCurrent && (
                              <Badge variant="secondary" className="text-xs">
                                Latest
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{formatRelativeTime(version.createdAt)}</span>
                            <span>-</span>
                            <span>{formatBytes(version.sizeBytes)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDownload(version.id)}
                          disabled={downloadingVersion === version.id}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {!isCurrent && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleRestore(version.id)}
                            disabled={restoringVersion === version.id}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleExpanded(version.id)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="mt-3 space-y-2 border-t pt-3">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Created
                            </p>
                            <p>{formatDateTime(version.createdAt)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Size</p>
                            <p>{formatBytes(version.sizeBytes)}</p>
                          </div>
                          {version.checksum && (
                            <div className="col-span-2">
                              <p className="text-xs text-muted-foreground">
                                Checksum (SHA-256)
                              </p>
                              <p className="truncate font-mono text-xs">
                                {version.checksum}
                              </p>
                            </div>
                          )}
                        </div>

                        {version.createdBy && (
                          <div className="flex items-center gap-2 pt-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage
                                src={version.createdBy.avatarUrl}
                                alt={
                                  version.createdBy.name || version.createdBy.email
                                }
                              />
                              <AvatarFallback className="text-xs">
                                {(
                                  version.createdBy.name?.[0] ||
                                  version.createdBy.email?.[0] ||
                                  '?'
                                ).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">
                              Uploaded by{' '}
                              {version.createdBy.name || version.createdBy.email}
                            </span>
                          </div>
                        )}

                        {version.changeNote && (
                          <div className="rounded-md bg-muted p-2">
                            <p className="text-xs text-muted-foreground">
                              Change note
                            </p>
                            <p className="text-sm">{version.changeNote}</p>
                          </div>
                        )}

                        {!isCurrent && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 w-full"
                            onClick={() => handleRestore(version.id)}
                            disabled={restoringVersion === version.id}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            {restoringVersion === version.id
                              ? 'Restoring...'
                              : 'Restore this version'}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
