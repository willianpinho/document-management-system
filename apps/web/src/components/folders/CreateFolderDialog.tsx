'use client';

import { useState } from 'react';
import { Folder } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
} from '@dms/ui';

interface CreateFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
  parentFolderName?: string;
  isCreating?: boolean;
}

export function CreateFolderDialog({
  isOpen,
  onClose,
  onCreate,
  parentFolderName,
  isCreating,
}: CreateFolderDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Folder name is required');
      return;
    }

    if (trimmedName.length > 255) {
      setError('Folder name must be less than 255 characters');
      return;
    }

    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(trimmedName)) {
      setError('Folder name contains invalid characters');
      return;
    }

    setError('');
    onCreate(trimmedName);
  };

  const handleClose = () => {
    setName('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-blue-500" />
            Create new folder
          </DialogTitle>
          <DialogDescription>
            {parentFolderName
              ? `Create a new folder inside "${parentFolderName}"`
              : 'Create a new folder to organize your documents'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="py-4">
            <label htmlFor="folder-name" className="mb-2 block text-sm font-medium">
              Folder name
            </label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="Enter folder name"
              autoFocus
              disabled={isCreating}
            />
            {error && (
              <p className="mt-2 text-sm text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isCreating}>
              {isCreating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface RenameFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRename: (newName: string) => void;
  currentName: string;
  isRenaming?: boolean;
}

export function RenameFolderDialog({
  isOpen,
  onClose,
  onRename,
  currentName,
  isRenaming,
}: RenameFolderDialogProps) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Folder name is required');
      return;
    }

    if (trimmedName === currentName) {
      handleClose();
      return;
    }

    if (trimmedName.length > 255) {
      setError('Folder name must be less than 255 characters');
      return;
    }

    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(trimmedName)) {
      setError('Folder name contains invalid characters');
      return;
    }

    setError('');
    onRename(trimmedName);
  };

  const handleClose = () => {
    setName(currentName);
    setError('');
    onClose();
  };

  // Update name when currentName changes (dialog reopened with different folder)
  useState(() => {
    setName(currentName);
  });

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-blue-500" />
            Rename folder
          </DialogTitle>
          <DialogDescription>
            Enter a new name for this folder
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="py-4">
            <label htmlFor="folder-rename" className="mb-2 block text-sm font-medium">
              Folder name
            </label>
            <Input
              id="folder-rename"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="Enter folder name"
              autoFocus
              disabled={isRenaming}
            />
            {error && (
              <p className="mt-2 text-sm text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isRenaming}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isRenaming}>
              {isRenaming ? 'Renaming...' : 'Rename'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
  folderName: string;
  documentCount: number;
  isDeleting?: boolean;
}

export function DeleteFolderDialog({
  isOpen,
  onClose,
  onDelete,
  folderName,
  documentCount,
  isDeleting,
}: DeleteFolderDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete folder</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{folderName}&quot;?
            {documentCount > 0 && (
              <span className="mt-2 block text-destructive">
                This folder contains {documentCount}{' '}
                {documentCount === 1 ? 'document' : 'documents'} that will also
                be deleted.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onDelete} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
