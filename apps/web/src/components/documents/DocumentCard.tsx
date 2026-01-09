'use client';

import Link from 'next/link';
import {
  FileText,
  Image,
  Video,
  Music,
  FileSpreadsheet,
  FileCode,
  File,
  MoreVertical,
  Download,
  Pencil,
  Trash2,
  Copy,
  FolderInput,
  Eye,
} from 'lucide-react';
import {
  Card,
  CardContent,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@dms/ui';
import type { DocumentListItem } from '@/hooks/useDocuments';
import { formatBytes, formatRelativeTime, getMimeTypeColor } from '@/lib/utils';

interface DocumentCardProps {
  document: DocumentListItem;
  onDownload?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string) => void;
  onMove?: (id: string) => void;
  onCopy?: (id: string) => void;
  onPreview?: (id: string) => void;
}

function getDocumentIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('video/')) return Video;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType === 'application/pdf') return FileText;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel'))
    return FileSpreadsheet;
  if (mimeType.includes('text') || mimeType.includes('code')) return FileCode;
  return File;
}

function getStatusBadgeVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ready':
      return 'default';
    case 'processing':
      return 'secondary';
    case 'error':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function DocumentCard({
  document,
  onDownload,
  onDelete,
  onRename,
  onMove,
  onCopy,
  onPreview,
}: DocumentCardProps) {
  const Icon = getDocumentIcon(document.mimeType);
  const iconColor = getMimeTypeColor(document.mimeType);

  return (
    <Card className="group relative transition-all hover:shadow-md">
      <Link href={`/documents/${document.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-lg bg-muted ${iconColor}`}
            >
              <Icon className="h-6 w-6" />
            </div>
            <Badge variant={getStatusBadgeVariant(document.status)}>
              {document.status}
            </Badge>
          </div>

          <div className="mt-4">
            <h3 className="truncate text-sm font-medium" title={document.name}>
              {document.name}
            </h3>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatBytes(document.sizeBytes)}</span>
              <span>-</span>
              <span>{formatRelativeTime(document.createdAt)}</span>
            </div>
          </div>

          {document.thumbnailUrl && (
            <div className="mt-3 overflow-hidden rounded-md">
              <img
                src={document.thumbnailUrl}
                alt={document.name}
                className="h-24 w-full object-cover"
              />
            </div>
          )}
        </CardContent>
      </Link>

      {/* Actions dropdown */}
      <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => e.preventDefault()}
            >
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onPreview && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  onPreview(document.id);
                }}
              >
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </DropdownMenuItem>
            )}
            {onDownload && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  onDownload(document.id);
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {onRename && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  onRename(document.id);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Rename
              </DropdownMenuItem>
            )}
            {onMove && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  onMove(document.id);
                }}
              >
                <FolderInput className="mr-2 h-4 w-4" />
                Move to...
              </DropdownMenuItem>
            )}
            {onCopy && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  onCopy(document.id);
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Make a copy
              </DropdownMenuItem>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    onDelete(document.id);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}
