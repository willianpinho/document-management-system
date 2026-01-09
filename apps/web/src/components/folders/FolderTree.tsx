'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  FolderInput,
} from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@dms/ui';
import type { FolderTreeItem } from '@/hooks/useFolders';
import { cn } from '@/lib/utils';

interface FolderTreeProps {
  folders: FolderTreeItem[];
  selectedFolderId?: string;
  onCreateFolder?: (parentId?: string) => void;
  onRenameFolder?: (id: string) => void;
  onDeleteFolder?: (id: string) => void;
  onMoveFolder?: (id: string) => void;
  isLoading?: boolean;
}

export function FolderTree({
  folders,
  selectedFolderId,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveFolder,
  isLoading,
}: FolderTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-8 animate-pulse rounded-md bg-muted"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {/* Root level "All Documents" */}
      <Link
        href="/documents"
        className={cn(
          'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
          !selectedFolderId
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}
      >
        <Folder className="h-4 w-4" />
        <span>All Documents</span>
      </Link>

      {/* Folder tree */}
      {folders.map((folder) => (
        <FolderTreeNode
          key={folder.id}
          folder={folder}
          level={0}
          selectedFolderId={selectedFolderId}
          expandedFolders={expandedFolders}
          onToggle={toggleFolder}
          onCreateFolder={onCreateFolder}
          onRenameFolder={onRenameFolder}
          onDeleteFolder={onDeleteFolder}
          onMoveFolder={onMoveFolder}
        />
      ))}

      {/* Add folder button */}
      {onCreateFolder && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full justify-start text-muted-foreground"
          onClick={() => onCreateFolder()}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Folder
        </Button>
      )}
    </div>
  );
}

interface FolderTreeNodeProps {
  folder: FolderTreeItem;
  level: number;
  selectedFolderId?: string;
  expandedFolders: Set<string>;
  onToggle: (id: string) => void;
  onCreateFolder?: (parentId?: string) => void;
  onRenameFolder?: (id: string) => void;
  onDeleteFolder?: (id: string) => void;
  onMoveFolder?: (id: string) => void;
}

function FolderTreeNode({
  folder,
  level,
  selectedFolderId,
  expandedFolders,
  onToggle,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveFolder,
}: FolderTreeNodeProps) {
  const isExpanded = expandedFolders.has(folder.id);
  const isSelected = selectedFolderId === folder.id;
  const hasChildren = folder.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1 rounded-md text-sm transition-colors',
          isSelected
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}
        style={{ paddingLeft: `${level * 12 + 4}px` }}
      >
        {/* Expand/collapse button */}
        <button
          onClick={() => onToggle(folder.id)}
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded transition-colors',
            hasChildren ? 'hover:bg-black/10' : 'invisible'
          )}
        >
          {hasChildren &&
            (isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            ))}
        </button>

        {/* Folder link */}
        <Link
          href={`/folders/${folder.id}`}
          className="flex flex-1 items-center gap-2 py-1.5 pr-2"
        >
          {isExpanded ? (
            <FolderOpen className="h-4 w-4" />
          ) : (
            <Folder className="h-4 w-4" />
          )}
          <span className="truncate">{folder.name}</span>
        </Link>

        {/* Actions menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onCreateFolder && (
              <DropdownMenuItem onClick={() => onCreateFolder(folder.id)}>
                <Plus className="mr-2 h-4 w-4" />
                New subfolder
              </DropdownMenuItem>
            )}
            {onRenameFolder && (
              <DropdownMenuItem onClick={() => onRenameFolder(folder.id)}>
                <Pencil className="mr-2 h-4 w-4" />
                Rename
              </DropdownMenuItem>
            )}
            {onMoveFolder && (
              <DropdownMenuItem onClick={() => onMoveFolder(folder.id)}>
                <FolderInput className="mr-2 h-4 w-4" />
                Move to...
              </DropdownMenuItem>
            )}
            {onDeleteFolder && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDeleteFolder(folder.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {folder.children.map((child) => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              level={level + 1}
              selectedFolderId={selectedFolderId}
              expandedFolders={expandedFolders}
              onToggle={onToggle}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onMoveFolder={onMoveFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}
