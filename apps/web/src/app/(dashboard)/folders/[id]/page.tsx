'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  FolderPlus,
  Upload,
  Folder,
  Pencil,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@dms/ui';
import { FolderBreadcrumb } from '@/components/folders/FolderBreadcrumb';
import { FolderCard } from '@/components/folders/FolderCard';
import { DocumentList } from '@/components/documents/DocumentList';
import { DocumentUpload } from '@/components/documents/DocumentUpload';
import {
  CreateFolderDialog,
  RenameFolderDialog,
  DeleteFolderDialog,
} from '@/components/folders/CreateFolderDialog';
import {
  useFolder,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
  type FolderListItem,
} from '@/hooks/useFolders';
import { useDeleteDocument } from '@/hooks/useDocuments';
import { formatBytes, formatRelativeTime, downloadFile } from '@/lib/utils';

export default function FolderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const folderId = params.id as string;

  // State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isCreateSubfolderOpen, setIsCreateSubfolderOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Queries
  const { data: folder, isLoading, error } = useFolder(folderId);

  // Mutations
  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();
  const deleteDocument = useDeleteDocument();

  // Handlers
  const handleCreateSubfolder = useCallback(async (name: string) => {
    await createFolder.mutateAsync({ name, parentId: folderId });
    setIsCreateSubfolderOpen(false);
  }, [createFolder, folderId]);

  const handleRename = useCallback(async (newName: string) => {
    await updateFolder.mutateAsync({
      id: folderId,
      data: { name: newName },
    });
    setIsRenameOpen(false);
  }, [updateFolder, folderId]);

  const handleDelete = useCallback(async () => {
    await deleteFolder.mutateAsync(folderId);
    // Navigate to parent folder or folders list
    if (folder?.parentId) {
      router.push(`/folders/${folder.parentId}`);
    } else {
      router.push('/folders');
    }
  }, [deleteFolder, folderId, folder, router]);

  const handleSortChange = useCallback((newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
  }, []);

  const handleDownloadDocument = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/v1/documents/${id}/download`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      const data = await response.json();
      if (data.data?.url) {
        const doc = folder?.documents.find((d) => d.id === id);
        downloadFile(data.data.url, doc?.name || 'download');
      }
    } catch (error) {
      console.error('Download failed:', error);
    }
  }, [folder]);

  const handleDeleteDocument = useCallback(async (id: string) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      await deleteDocument.mutateAsync(id);
    }
  }, [deleteDocument]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Loading folder...</span>
        </div>
      </div>
    );
  }

  if (error || !folder) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Folder className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Folder not found</h2>
        <p className="text-muted-foreground">
          The folder you&apos;re looking for doesn&apos;t exist or has been deleted.
        </p>
        <Button asChild>
          <Link href="/folders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Folders
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4">
        <div className="mb-4">
          <FolderBreadcrumb items={folder.breadcrumb || []} />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-blue-500">
              <Folder className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{folder.name}</h1>
              <p className="text-sm text-muted-foreground">
                {folder.documentCount} items - {formatBytes(folder.totalSizeBytes)} total
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsCreateSubfolderOpen(true)}>
              <FolderPlus className="mr-2 h-4 w-4" />
              New Subfolder
            </Button>
            <Button onClick={() => setIsUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsRenameOpen(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setIsDeleteOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Subfolders */}
        {folder.subfolders && folder.subfolders.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-sm font-medium text-muted-foreground">
              Folders ({folder.subfolders.length})
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {folder.subfolders.map((subfolder) => (
                <FolderCard key={subfolder.id} folder={subfolder} />
              ))}
            </div>
          </div>
        )}

        {/* Documents */}
        <div>
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">
            Documents ({folder.documents?.length || 0})
          </h2>
          <DocumentList
            documents={folder.documents || []}
            onDownload={handleDownloadDocument}
            onDelete={handleDeleteDocument}
            onRename={(id) => router.push(`/documents/${id}?edit=true`)}
            onMove={(id) => router.push(`/documents/${id}?move=true`)}
            onCopy={(id) => router.push(`/documents/${id}?copy=true`)}
            onPreview={(id) => router.push(`/documents/${id}`)}
            onUpload={() => setIsUploadOpen(true)}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
          />
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Documents to {folder.name}</DialogTitle>
          </DialogHeader>
          <DocumentUpload
            folderId={folderId}
            onComplete={(ids) => {
              if (ids.length > 0) {
                setIsUploadOpen(false);
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <CreateFolderDialog
        isOpen={isCreateSubfolderOpen}
        onClose={() => setIsCreateSubfolderOpen(false)}
        onCreate={handleCreateSubfolder}
        parentFolderName={folder.name}
        isCreating={createFolder.isPending}
      />

      <RenameFolderDialog
        isOpen={isRenameOpen}
        onClose={() => setIsRenameOpen(false)}
        onRename={handleRename}
        currentName={folder.name}
        isRenaming={updateFolder.isPending}
      />

      <DeleteFolderDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onDelete={handleDelete}
        folderName={folder.name}
        documentCount={folder.documentCount}
        isDeleting={deleteFolder.isPending}
      />
    </div>
  );
}
