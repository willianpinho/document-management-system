'use client';

import { useState, useCallback } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Loader2,
  Home,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
} from '@dms/ui';
import { useFolderTree, type FolderTreeItem } from '@/hooks/useFolders';
import { cn } from '@/lib/utils';

interface FolderPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (folderId: string | null) => Promise<void>;
  title: string;
  description?: string;
  excludeFolderId?: string;
  currentFolderId?: string | null;
}

interface FolderNodeProps {
  folder: FolderTreeItem;
  level: number;
  selectedFolderId: string | null;
  expandedFolders: Set<string>;
  excludeFolderId?: string;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}

function FolderNode({
  folder,
  level,
  selectedFolderId,
  expandedFolders,
  excludeFolderId,
  onSelect,
  onToggle,
}: FolderNodeProps) {
  const isExpanded = expandedFolders.has(folder.id);
  const isSelected = selectedFolderId === folder.id;
  const hasChildren = folder.children.length > 0;
  const isExcluded = folder.id === excludeFolderId;

  // Filter out excluded folder and its children
  if (isExcluded) {
    return null;
  }

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 rounded-md text-sm transition-colors cursor-pointer',
          isSelected
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-muted'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {/* Expand/collapse button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(folder.id);
          }}
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded transition-colors shrink-0',
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

        {/* Folder content */}
        <button
          type="button"
          onClick={() => onSelect(folder.id)}
          className="flex flex-1 items-center gap-2 py-2 pr-3 text-left"
        >
          {isExpanded ? (
            <FolderOpen className="h-4 w-4 shrink-0" />
          ) : (
            <Folder className="h-4 w-4 shrink-0" />
          )}
          <span className="truncate">{folder.name}</span>
        </button>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {folder.children
            .filter((child) => child.id !== excludeFolderId)
            .map((child) => (
              <FolderNode
                key={child.id}
                folder={child}
                level={level + 1}
                selectedFolderId={selectedFolderId}
                expandedFolders={expandedFolders}
                excludeFolderId={excludeFolderId}
                onSelect={onSelect}
                onToggle={onToggle}
              />
            ))}
        </div>
      )}
    </div>
  );
}

export function FolderPickerDialog({
  open,
  onOpenChange,
  onSelect,
  title,
  description,
  excludeFolderId,
  currentFolderId,
}: FolderPickerDialogProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
    currentFolderId ?? null
  );
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: folders, isLoading } = useFolderTree();

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

  const handleSelect = async () => {
    setIsSubmitting(true);
    try {
      await onSelect(selectedFolderId);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset selection when closing
      setSelectedFolderId(currentFolderId ?? null);
    }
    onOpenChange(newOpen);
  };

  const filteredFolders =
    folders?.filter((f) => f.id !== excludeFolderId) || [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto rounded-md border">
          {/* Root folder option */}
          <button
            type="button"
            className={cn(
              'w-full flex items-center gap-2 p-3 hover:bg-muted text-left transition-colors',
              selectedFolderId === null && 'bg-primary text-primary-foreground'
            )}
            onClick={() => setSelectedFolderId(null)}
          >
            <Home className="h-4 w-4 shrink-0" />
            <span>Root (My Documents)</span>
          </button>

          {/* Separator */}
          {filteredFolders.length > 0 && (
            <div className="border-t" />
          )}

          {isLoading ? (
            <div className="flex items-center justify-center p-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredFolders.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No folders available
            </div>
          ) : (
            <div className="py-1">
              {filteredFolders.map((folder) => (
                <FolderNode
                  key={folder.id}
                  folder={folder}
                  level={0}
                  selectedFolderId={selectedFolderId}
                  expandedFolders={expandedFolders}
                  excludeFolderId={excludeFolderId}
                  onSelect={setSelectedFolderId}
                  onToggle={toggleFolder}
                />
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSelect} disabled={isSubmitting}>
            {isSubmitting && (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            )}
            Select
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
