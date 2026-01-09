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

interface DocumentListRowProps {
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

export function DocumentListRow({
  document,
  onDownload,
  onDelete,
  onRename,
  onMove,
  onCopy,
  onPreview,
}: DocumentListRowProps) {
  const Icon = getDocumentIcon(document.mimeType);
  const iconColor = getMimeTypeColor(document.mimeType);

  return (
    <div className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50">
      <Link
        href={`/documents/${document.id}`}
        className="flex flex-1 items-center gap-4"
      >
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted ${iconColor}`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium" title={document.name}>
            {document.name}
          </h3>
          <p className="text-xs text-muted-foreground">
            {formatRelativeTime(document.createdAt)}
          </p>
        </div>

        <div className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <span className="w-24 text-right">{formatBytes(document.sizeBytes)}</span>
          <Badge variant={getStatusBadgeVariant(document.status)} className="w-20 justify-center">
            {document.status}
          </Badge>
        </div>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onPreview && (
            <DropdownMenuItem onClick={() => onPreview(document.id)}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </DropdownMenuItem>
          )}
          {onDownload && (
            <DropdownMenuItem onClick={() => onDownload(document.id)}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {onRename && (
            <DropdownMenuItem onClick={() => onRename(document.id)}>
              <Pencil className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
          )}
          {onMove && (
            <DropdownMenuItem onClick={() => onMove(document.id)}>
              <FolderInput className="mr-2 h-4 w-4" />
              Move to...
            </DropdownMenuItem>
          )}
          {onCopy && (
            <DropdownMenuItem onClick={() => onCopy(document.id)}>
              <Copy className="mr-2 h-4 w-4" />
              Make a copy
            </DropdownMenuItem>
          )}
          {onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(document.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
