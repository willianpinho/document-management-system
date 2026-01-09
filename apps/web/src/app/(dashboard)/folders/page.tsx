'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FolderPlus, Upload, ArrowUpDown, ChevronDown } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@dms/ui';
import { FolderCard } from '@/components/folders/FolderCard';
import {
  CreateFolderDialog,
  RenameFolderDialog,
  DeleteFolderDialog,
} from '@/components/folders/CreateFolderDialog';
import { DocumentCard } from '@/components/documents/DocumentCard';
import {
  useFolders,
  useFolder,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
  type FolderListItem,
} from '@/hooks/useFolders';
import { useDocuments } from '@/hooks/useDocuments';

const sortOptions = [
  { value: 'name', label: 'Name' },
  { value: 'createdAt', label: 'Date created' },
  { value: 'updatedAt', label: 'Date modified' },
];

export default function FoldersPage() {
  const router = useRouter();

  // State
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [renameFolder, setRenameFolder] = useState<FolderListItem | null>(null);
  const [deleteFolder, setDeleteFolder] = useState<FolderListItem | null>(null);

  // Queries
  const { data: foldersData, isLoading } = useFolders({
    sortBy,
    sortOrder,
  });

  const { data: rootDocumentsData, isLoading: isLoadingDocs } = useDocuments({
    folderId: 'root', // Special value for root documents
    sortBy: 'createdAt',
    sortOrder: 'desc',
    limit: 6,
  });

  // Mutations
  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolderMutation = useDeleteFolder();

  // Handlers
  const handleSortChange = useCallback((value: string) => {
    if (value === sortBy) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(value);
      setSortOrder('asc');
    }
  }, [sortBy]);

  const handleCreateFolder = useCallback(async (name: string) => {
    await createFolder.mutateAsync({ name });
    setIsCreateOpen(false);
  }, [createFolder]);

  const handleRenameFolder = useCallback(async (newName: string) => {
    if (renameFolder) {
      await updateFolder.mutateAsync({
        id: renameFolder.id,
        data: { name: newName },
      });
      setRenameFolder(null);
    }
  }, [renameFolder, updateFolder]);

  const handleDeleteFolder = useCallback(async () => {
    if (deleteFolder) {
      await deleteFolderMutation.mutateAsync(deleteFolder.id);
      setDeleteFolder(null);
    }
  }, [deleteFolder, deleteFolderMutation]);

  const handleMoveFolder = useCallback((id: string) => {
    router.push(`/folders/${id}?move=true`);
  }, [router]);

  const folders = foldersData?.data || [];
  const rootDocuments = rootDocumentsData?.data || [];
  const currentSort = sortOptions.find((s) => s.value === sortBy) ?? sortOptions[0]!

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Folders</h1>
            <p className="text-sm text-muted-foreground">
              Organize your documents into folders
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  {currentSort.label}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {sortOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => handleSortChange(option.value)}
                  >
                    {option.label}
                    {sortBy === option.value && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {sortOrder === 'asc' ? '(A-Z)' : '(Z-A)'}
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => setIsCreateOpen(true)}>
              <FolderPlus className="mr-2 h-4 w-4" />
              New Folder
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-12 w-12 rounded-lg bg-muted" />
                  <div className="mt-4 h-4 w-3/4 rounded bg-muted" />
                  <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : folders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FolderPlus className="h-16 w-16 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No folders yet</h3>
              <p className="mt-1 text-muted-foreground">
                Create your first folder to organize your documents
              </p>
              <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
                <FolderPlus className="mr-2 h-4 w-4" />
                Create Folder
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Folders grid */}
            <div>
              <h2 className="mb-4 text-sm font-medium text-muted-foreground">
                Folders ({folders.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {folders.map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    onRename={(id) => {
                      const f = folders.find((f) => f.id === id);
                      if (f) setRenameFolder(f);
                    }}
                    onDelete={(id) => {
                      const f = folders.find((f) => f.id === id);
                      if (f) setDeleteFolder(f);
                    }}
                    onMove={handleMoveFolder}
                  />
                ))}
              </div>
            </div>

            {/* Root documents */}
            {rootDocuments.length > 0 && (
              <div>
                <h2 className="mb-4 text-sm font-medium text-muted-foreground">
                  Documents without folder
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {rootDocuments.map((doc) => (
                    <DocumentCard key={doc.id} document={doc} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreateFolderDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreateFolder}
        isCreating={createFolder.isPending}
      />

      {renameFolder && (
        <RenameFolderDialog
          isOpen={!!renameFolder}
          onClose={() => setRenameFolder(null)}
          onRename={handleRenameFolder}
          currentName={renameFolder.name}
          isRenaming={updateFolder.isPending}
        />
      )}

      {deleteFolder && (
        <DeleteFolderDialog
          isOpen={!!deleteFolder}
          onClose={() => setDeleteFolder(null)}
          onDelete={handleDeleteFolder}
          folderName={deleteFolder.name}
          documentCount={deleteFolder.documentCount}
          isDeleting={deleteFolderMutation.isPending}
        />
      )}
    </div>
  );
}
