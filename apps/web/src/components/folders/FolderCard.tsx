'use client';

import Link from 'next/link';
import {
  Folder,
  MoreVertical,
  Pencil,
  Trash2,
  FolderInput,
} from 'lucide-react';
import {
  Card,
  CardContent,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@dms/ui';
import type { FolderListItem } from '@/hooks/useFolders';
import { formatRelativeTime, pluralize } from '@/lib/utils';

interface FolderCardProps {
  folder: FolderListItem;
  onRename?: (id: string) => void;
  onDelete?: (id: string) => void;
  onMove?: (id: string) => void;
}

export function FolderCard({
  folder,
  onRename,
  onDelete,
  onMove,
}: FolderCardProps) {
  return (
    <Card className="group relative transition-all hover:shadow-md" data-testid="folder-card">
      <Link href={`/folders/${folder.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-blue-500">
              <Folder className="h-6 w-6" />
            </div>
          </div>

          <div className="mt-4">
            <h3 className="truncate text-sm font-medium" title={folder.name}>
              {folder.name}
            </h3>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {folder.documentCount}{' '}
                {pluralize(folder.documentCount, 'item')}
              </span>
              <span>-</span>
              <span>{formatRelativeTime(folder.createdAt)}</span>
            </div>
          </div>
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
            {onRename && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  onRename(folder.id);
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
                  onMove(folder.id);
                }}
              >
                <FolderInput className="mr-2 h-4 w-4" />
                Move to...
              </DropdownMenuItem>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    onDelete(folder.id);
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
